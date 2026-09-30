> Historical document (English label). Kept as recorded; not the current contract.

# Auditoria de Alinhamento Formulários × Banco de Dados

> Fase 13B (retomada) — mandato: nenhuma migration financeira adicional roda
> enquanto o schema relacional não estiver comprovadamente compatível com os
> formulários ativos. Este documento registra o método, as evidências e o
> resultado desta auditoria.

## 1. Metodologia

Em vez de inspecionar manualmente centenas de campos em dezenas de módulos
sem guia, a auditoria partiu do próprio mecanismo que o projeto já usa para
resolver exatamente este problema: migrations nomeadas `*FormFieldColumns`,
seguindo a **regra de produto de 2026-07-12** ("cada campo do formulário tem
a SUA coluna física, nome exato, nunca agregado em `metadata` jsonb").
Localizamos essas migrations no disco, confirmamos que cobrem os domínios
alegados como quebrados, lemos cada uma por completo (`up`/`down`, simetria
de colunas, migração de dados legados de `metadata`→coluna) e cruzamos com
entity, DTO, service e formulário do frontend para o caso citado (`artists`).

## 2. Achado principal

**`artists` NÃO é uma lacuna de modelagem não descoberta.** É uma migration
já **inteiramente escrita, correta e completa**
(`20260712000001_ArtistsFormFieldColumns.ts`, presente em disco, ainda não
commitada em git — uma das "162 pendências" desta sessão), que:
- adiciona as 45 colunas que faltam na tabela `artists` de InitialSchema,
  com o nome EXATO usado por `formToArtistaPayload` (frontend);
- migra dados legados que viviam em `metadata` jsonb para as colunas novas
  (`UPDATE ... COALESCE(coluna, metadata->>'chave')`), sem apagar o
  `metadata` original;
- tem `down()` simétrico (45 `DROP COLUMN IF EXISTS`, mesma lista).

A razão de a tabela **parecer** incompleta é que o replay desta fase está
**pausado na posição 75/92** (bloqueado pelo bug de FORCE RLS, corrigido
nesta mesma retomada) — e esta migration está em posição **posterior** na
cadeia (timestamp `20260712000001`), ainda não executada. Não é uma falha de
autoria; é um estado normal de banco em reconstrução.

## 3. Inventário de formulários (escopo desta auditoria)

Método de inventário: busca por migrations `*FormFieldColumns` (mecanismo
canônico do projeto) + leitura completa dos arquivos + cruzamento pontual
com o formulário frontend do domínio mais citado (`artists`). **Este NÃO é
um inventário exaustivo de todos os ~100+ módulos do repositório** — ver
§6 (escopo não coberto) para o que fica fora desta rodada.

| Migration | Tabelas | Data | Estado no replay |
|---|---|---|---|
| `20260712000001_ArtistsFormFieldColumns` | artists | 2026-07-12 | pendente (posição >75) |
| `20260712000002_CatalogFormFieldColumns` | phonograms, works | 2026-07-12 | pendente |
| `20260712000003_HrFormFieldColumns` | employees, leave_requests, payroll_entries | 2026-07-12 | pendente |
| `20260712000004_SharesContractsFormFieldColumns` | contracts, shares | 2026-07-12 | pendente |
| `20260712000005_CrmFinanceOpsFormFieldColumns` | clients, events, invoices, leads, licenses, takedowns, transactions | 2026-07-12 | pendente |

**15 tabelas** cobertas por este esforço (confirma a memória de sessão:
"regra sem-metadata aplicada em 15 módulos", 2026-07-12).

## 4. Auditoria detalhada de `artists`

### 4.1 Cadeia verificada
`entities.ts` (`ArtistEntity`, 73 colunas) → `create-artist.dto.ts` (DTO
aceita todos os campos do formulário) → `update-artist.dto.ts`
(`PartialType(CreateArtistDto)` — idêntico, campos opcionais) →
`artists.service.ts` (persistência **dirigida por contrato**:
`NULLABLE_COLUMNS`/`REQUIRED_COLUMNS`/`JSONB_LIST_COLUMNS`/`ENCRYPTED_FIELDS`
derivados de `REPORT_FORM_CONTRACTS.artists` — nenhuma lista hardcoded
divergente; um campo novo no contrato é automaticamente persistido) →
frontend `artist-form.definition.ts` (fonte única do formulário: campos,
schema Zod gerado, hidratação, export/import todos da MESMA definição) →
`artista.mapper.ts` (`formToArtistaPayload`/`artistaToFormFields`).

### 4.2 Matriz (campo do formulário → coluna/relação atual)

| Campo do formulário | Coluna/relação | Situação |
|---|---|---|
| fotoUrl | `foto_url` (text) | CORRETO |
| nomeArtistico | `nome_artistico` (varchar 255, NOT NULL) | CORRETO |
| generoMusical | `genero_musical` (varchar 100) | CORRETO |
| especialidades | `especialidades` (jsonb) | CORRETO |
| documentosPessoaisUrl | `documentos_pessoais_url` (text) | CORRETO — coluna na migration pendente |
| presskitUrl | `presskit_url` (text) | CORRETO — coluna na migration pendente |
| biografia | `observacoes` (text) | CORRETO (nome divergente documentado: form chama "biografia", coluna é `observacoes` — mapeamento explícito e estável, não um bug) |
| nome (civil) | `nome_civil` (varchar 255) | CORRETO |
| dataNascimento | `data_nascimento` (date) | CORRETO — coluna na migration pendente |
| cpfCnpj | `cpf_cnpj_encrypted` (text, cifrado) | CORRETO — PII cifrada, 1 coluna |
| rg | `rg` (varchar 30) | CORRETO — coluna na migration pendente |
| genero | `genero` (varchar 30) | CORRETO — coluna na migration pendente |
| endereco | `endereco` (varchar 300) | CORRETO — coluna na migration pendente |
| telefone | `telefone_encrypted` (text, cifrado) | CORRETO |
| email | `email_encrypted` (text, cifrado) | CORRETO |
| banco/agencia/conta/chavePix/titularConta | `banco`/`agencia`/`conta`/`chave_pix`/`titular_conta` | CORRETO — colunas na migration pendente |
| spotify/instagram/youtube/tiktok/soundcloud/deezer/appleMusic | `spotify_url`/`instagram`/`youtube_url`/`tiktok`/`soundcloud_url`/`deezer_url`/`apple_music_url` | CORRETO |
| tipoPerfil | `tipo_perfil` (varchar 30) | CORRETO — coluna na migration pendente |
| distribuidorasGerais | `distribuidoras_gerais` (jsonb) | CORRETO — coluna na migration pendente |
| contatosVinculados | `contatos_vinculados` (jsonb) | CORRETO — coluna na migration pendente |
| notasInternas | `notas_internas` (text) | CORRETO — coluna na migration pendente |
| relacionamentos (empresário/gravadora/editora) | `relacionamentos` (jsonb) + campos legados `empresario_*`/`gravadora_*` preservados p/ retrocompat | CORRETO — todas colunas na migration pendente |
| \*_seguidores/\*_ouvintes/\*_fas/\*_albuns (métricas de plataforma) | colunas `integer` dedicadas por plataforma | CORRETO — colunas na migration pendente |

**Nenhuma linha "COLUNA AUSENTE" real** — todas as colunas necessárias já
estão especificadas na migration pendente `ArtistsFormFieldColumns`.

## 5. Ação corretiva

**Nenhuma migration nova é necessária para os 15 tabelas listadas em §3.**
A ação correta é deixar o replay avançar até essas migrations (posições
posteriores à 75, dentro da cadeia legada já auditada na Fase 13B). As 5
migrations foram relidas por completo nesta auditoria: `up()`/`down()`
simétricos, sem `CASCADE` amplo, sem dado de negócio inserido (apenas
migração de valores já existentes de `metadata`→coluna, quando havia).

## 6. Rodada 2 — auditoria exaustiva (autorizada pelo usuário após §6 original)

A rodada 1 (acima) cobriu só `artists` em profundidade + verificação
estrutural das 14 tabelas irmãs. O usuário optou explicitamente por
"auditoria exaustiva completa antes de prosseguir" — segue o resultado,
módulo a módulo, com evidência de código (payload real enviado no submit,
não apenas o schema Zod de validação — vários módulos têm schemas Zod
**mortos/não usados**, o payload real é montado separadamente).

### 6.1 Domínios CORRETOS (payload real ↔ colunas confirmadas)
`artists`, `inventory`, `crm-relationships`/`leads` (memória estava
desatualizada — já reconciliado), `catalog`/phonograms, `rh`/employees,
`monitoring`/takedowns, `licensing`, `contracts`. `releases` é funcional
(sem perda de dados) mas usa `metadata` deliberadamente para campos extras —
inconsistente com a "regra sem-metadata" das 15 tabelas, porém documentado
e não quebrado (categoria F — JSONB justificado).

### 6.2 Achados CRÍTICOS confirmados (evidência: DTO + payload real lidos)

Pré-requisito verificado: `apps/api/src/main.ts` configura
`ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })`
globalmente — qualquer propriedade não declarada no DTO **rejeita a
requisição inteira com 400**, não apenas descarta o campo silenciosamente.

| # | Módulo | Evidência | Efeito |
|---|---|---|---|
| 1 | **audiovisual** (`AudiovisualProjectFormModal.tsx:153-177`) | payload envia `music_id, music_title, artist_name, format, videomaker, editor, shooting_date, location, capture_status, editing_status, approval_status, pre_release_date, release_date, budget, real_cost, concept, observations, final_status` — `CreateAudiovisualProjectDto` não declara NENHUM desses (usa `recording_date`, `budget_estimated`, `budget_actual`, `publish_date`, `description`, sem `format/videomaker/editor/location/capture_status/editing_status/approval_status`) | **Criação de projeto audiovisual sempre falha (400)**; mesmo sem o whitelist, `artist_id`/`phonogram_id` nunca seriam setados (vínculo com catálogo perdido) |
| 2 | **projects** (genérico) (`ProjetoFormModal.tsx:254-274`) | payload envia `titulo, tipo, status, observacoes, descricao, genero` — `CreateProjectDto` exige `title`+`type` (nomes em inglês, ausentes do payload) e não tem `observacoes`/`genero`; `ProjectEntity` tem `nome` (não `titulo`) | **Criação de projeto sempre falha (400)** — campos obrigatórios do DTO nunca chegam |
| 3 | **settings/usuarios** (`useUsuarios.ts:34-53`) | update envia `{full_name, phone, cargo}` — `UpdateUserDto` espera `{fullName, avatarUrl, role, status}`; comentário do hook ainda descreve "abstração de MOCK_DATA" mas `usuarios→/users` já é endpoint real | **Editar usuário sempre falha (400)**; comentário do código está desatualizado |
| 4 | **marketing_tasks** (`marketing-forms.ts:459-477`, usado por `Tarefas.tsx`) | `toTaskInput` não inclui `marketing_project_id`/`task_key` (NOT NULL na entity); envia `targetType/targetName/owner/sector/deadline` sem coluna correspondente (`MarketingTaskEntity` tem `kind/assigned_to/due_date`) | Criação de tarefa de marketing provavelmente falha ou perde campos |

### 6.3 Achado retratado (falso positivo da primeira leitura)
`marketing` — a leitura inicial de `toProjectInput`/`projectFields` sugeria
quebra na criação de "Projeto de Marketing", mas **essas funções não têm
NENHUMA referência fora do próprio arquivo `marketing-forms.ts`** — são
código morto (categoria L). O caminho realmente usado (`MarketingFormModal`
por `Briefing.tsx`/`Tarefas.tsx`) foi auditado separadamente (ver 6.2 #4).

### 6.4 Achado de severidade MÉDIA/ALTA (não é perda de dado, é desperdício da reconciliação)
**`events`** (`SchedulerFormModal.tsx:435-460`): a migration
`CrmFinanceOpsFormFieldColumns` já criou colunas dedicadas
(`endereco, contato_local, valor_cache, publico_esperado, descricao,
participantes`), mas o formulário **continua roteando esses valores para
`metadata` jsonb** em vez das colunas — a "regra sem-metadata" foi aplicada
no banco mas não no frontend deste módulo especificamente. Dado é salvo (sem
perda), mas fica no lugar errado; qualquer leitura direta da coluna
(relatórios, dashboards) encontrará `NULL`.

### 6.5 Módulos com formulários simples/sem forms complexos (risco baixo, não aprofundado)
`admin`/`billing` (ações administrativas simples, poucos campos, sem
formulário rico), `support`, `musicchat`, `integrations`, `auth`,
`workspace` — nenhum `*FormModal*` de negócio complexo encontrado.
`dashboard`/`reports` são meta-módulos de leitura agregada, sem persistência
própria.

### 6.7 Auditoria estrutural programática (entity ↔ migrations, TODAS as 120 entities × 160 tabelas)

Em vez de reler manualmente cada formulário restante — impraticável para o
volume total do repositório —, foi escrito um script que extrai
programaticamente (a) toda coluna declarada em cada `@Entity`/`@Column` de
`entities.ts` e (b) toda coluna efetivamente materializada por
`CREATE TABLE`/`ALTER TABLE ... ADD COLUMN` em **todas** as 102 migrations
(92 legadas + 10 financeiras), e comparou os dois conjuntos para as 120
entities × 160 tabelas físicas totais.

**Resultado: 0 tabelas de entity sem `CREATE TABLE` correspondente; 0
colunas fantasma** (nenhuma entity declara coluna que nenhuma migration
materializa) — depois de corrigido um bug do próprio script (não tratava
`ALTER TABLE IF EXISTS <tabela>`, gerando 1 falso positivo em `leads` que foi
verificado e descartado por `grep` direto nas migrations).

Colunas **órfãs** (migration cria, entity não mapeia — direção seguramente
inofensiva, dado não perdido, apenas não exposto via TypeORM neste momento):
- `financial_category_rules`/`financial_categories`/`financial_category_centers`
  — módulo legado que a M2 (Fase 13B) substitui deliberadamente; esperado.
- `artists.banner_url`/`video_apresentacao_url` — removidas por
  `RemoveArtistBannerVideoFields` (o script não modela `DROP COLUMN`, por
  isso aparecem como "órfãs"; na prática já não existem após o replay).
- `audiovisual_projects.financial_project_id` / `marketing_projects.financial_project_id`
  — **achado real de menor severidade**: a ponte opcional criada pela M9
  (`FinancialOperationalBridges`, Fase 13A) ainda não foi refletida nas
  classes `AudiovisualProjectEntity`/`MarketingProjectEntity` — a coluna
  existirá no banco após o replay, mas o TypeORM não a lê/escreve até a
  entity ser atualizada (sem impacto agora: nenhum código ainda usa essa
  ponte). Registrar para a Fase 14 (entities do domínio financeiro).
- `content_detections.detectado_em`, `domain_event_log.occurred_at`,
  `lead_interactions.data`, `leads.tags` — colunas físicas existentes sem
  mapeamento na entity; BAIXA severidade (não são usadas pelos formulários
  auditados nas rodadas 1-2).

**Enums**: o domínio legado usa majoritariamente `varchar`+`CHECK`/enum
TypeScript (31 tipos com sufixo Status/Type/Tipo/Kind/Role) em vez de
`CREATE TYPE ... AS ENUM` nativo do Postgres — só 4 enums nativos legados
existem (`conversation_status`, `conversation_channel`,
`message_sender_type`, `form_status`), mais os 9 enums novos do domínio
financeiro (M1). Isso é uma escolha de arquitetura consistente, não uma
divergência.

**Sub-entidades de audiovisual** (shots, production-days, team-members,
deliverables, tasks, assets, approvals): confirmada a existência de DTO de
criação para as 7 (`CreateShotDto`, `CreateProductionDayDto`,
`CreateTeamMemberDto`, `CreateDeliverableDto`, `CreateTaskDto`,
`CreateAssetDto` — todos em `audiovisual.dto.ts`); **não foi feita a
comparação campo-a-campo com os formulários correspondentes** (mesmo perfil
de risco do achado #1 em §6.2, já que compartilham autoria/padrão com o
formulário principal de projeto — candidato prioritário para auditoria
futura).

**Billing, RBAC/permissions, notifications**: fazem parte das 120 entities
verificadas estruturalmente acima — **nenhuma apareceu na lista de colunas
fantasma**, ou seja, estruturalmente consistentes entre entity e migrations.
Não foi feita auditoria de formulário-a-formulário para esses domínios
(poucos/nenhum formulário complexo de criação identificado em rodada
anterior para billing/admin; RBAC e notifications não têm formulário de
usuário final, são geridos internamente).

### 6.8 Escopo ainda não verificado nesta rodada (transparência obrigatória)
Sub-entidades do audiovisual além do projeto principal (shots, production
days, team, deliverables, tasks, assets — 8 tabelas satélite, DTOs não
localizados/lidos); billing/subscriptions em profundidade; RBAC/permissions;
notifications. Nenhuma migration especulativa foi criada para eles.

## 7. Testes de contrato

Não foram criados testes novos de round-trip nesta rodada: os testes
existentes já cobrem parte do contrato (`artists.service.spec.ts`,
`create-artist.dto.spec.ts`, `legacy-platform-fields.guard.spec.ts`,
`artists-cross-tenant.integration.spec.ts`). Criar testes de round-trip
completo (`formulário → banco → API → formulário`) para os 15 domínios é
recomendado como próxima ação, mas depende de conexão real ao DEV (fora do
escopo "sem banco" desta fase de auditoria).

## 8. Dívida técnica remanescente registrada

- Módulos fora de §3 não auditados (ver §6) — candidatos a auditoria futura,
  priorizados por risco (financeiro já auditado nas Fases 10-12; próximo
  candidato natural: audiovisual e marketing, por volume de formulários).
- `artists.genero` (gênero da pessoa) e `artists.genero_musical` (gênero
  musical) coexistem com nomes próximos — não é um bug, mas vale considerar
  renomear em uma fase de limpeza de nomenclatura futura (fora do escopo
  "apenas correções inequívocas" desta fase).

## 9. Contagem de migrations (atualizada)

```text
92 legadas (incluindo as 5 FormFieldColumns já existentes — SEM alteração)
10 financeiras (M0–M9, Fase 13A)
0 migrations corretivas NOVAS criadas nesta fase
TOTAL = 102 (inalterado)
```

> **Atualização da Rodada 3 (§11)**: +1 migration corretiva criada
> (`20260718000010_ReleasesFormFieldColumns`), **não executada**. Novo total
> de migrations no repositório = 103 (92 legadas + 10 financeiras + 1 nova).
> DEV permanece em 74/92 — nenhuma migration foi executada nesta rodada.

**Nuance importante**: dos 4 achados CRÍTICOS da rodada 2 (§6.2), **nenhum
precisa necessariamente de migration nova**:
- `audiovisual_projects` é o único caso que genuinamente falta COLUNA no
  banco (format, videomaker, editor, location, capture_status,
  editing_status, approval_status, pre_release_date) — os demais 3 achados
  são divergência de nomes entre frontend/DTO/hook, com as colunas já
  existindo (ou existindo sob outro nome) na entity — a correção é de
  **código** (DTO + payload), não de schema.
- Nenhum dos 4 achados pertence às tabelas do domínio financeiro
  (`financial_transactions`, `transaction_allocations`, `budgets`,
  `performance_metric_entries`) nem depende delas — **não bloqueiam
  tecnicamente** a continuação do replay M0–M9.

## 10. Ordem final de replay (recomendada)

```text
1. retomar migrations legadas 75–92 (inclui as 5 FormFieldColumns) — JÁ CORRIGIDO o bloqueio de 75
2. validar 92/92 registradas
3. executar M0–M9 (Fase 13A, incl. M2 corrigida na Fase 13B)
4. validações completas (invariantes, RLS, maior resto, conciliação)
```

## 11. Rodada 3 — correção de vocabulário e auditoria works/metadata/órfãos (2026-07-18)

### 11.1 Correção de uma premissa incorreta da rodada anterior

O usuário apontou que a auditoria anterior poderia ter usado nomes inventados
("codigo_abramus", "detentores") em vez do vocabulário real e ativo do
sistema. Investigação exaustiva (grep em `apps/api/src` e `apps/web/src`,
leitura de `obra-schema.ts`, `ObraFormModal.tsx`,
`registro-musicas.mapper.ts`, `create-work.dto.ts`, `entities.ts`,
`report-form-contracts.ts`) produziu o seguinte resultado, que **corrige**
parcialmente a premissa e **confirma** parcialmente a preocupação de fundo:

- **`codigo_abramus` nunca existiu em nenhuma camada do sistema.** Buscas por
  `codigo_abramus`, `cod_abramus_alt`, `abramus_code`, `codigo_entidade`,
  `cod_entidade` e `entity_code` retornaram zero ocorrências. O nome
  canônico real, usado de ponta a ponta — Zod (`obra-schema.ts: codAbramus`),
  form (`ObraFormModal.tsx`), mapper (`formToObraPayload: cod_abramus`), DTO
  (`CreateWorkDto.cod_abramus`), entity (`WorkEntity.cod_abramus`), migration
  (`InitialSchema`, coluna física `cod_abramus VARCHAR(100)`), contrato de
  Reports (`WORKS_CONTRACT: col('cod_abramus')`) — é **`cod_abramus` /
  `codAbramus`**. Este não foi um nome introduzido por mim: é anterior a toda
  esta sessão (migration inicial do projeto).
- **`detentores` também não foi inventado.** É uma coluna real desde a
  primeira migration (`20240101000000_InitialSchema.ts`), ativamente lida
  por `external-data-exchange.service.ts` (`holders: w.detentores`), exibida
  em `RightsMonitoring.tsx`/`ExecucaoDetailModal.tsx`, e declarada como campo
  somente-leitura no contrato oficial de Reports (`WORKS_CONTRACT: ro('detentores')`).
  Não é um bug de nomenclatura — é dado legado ainda consumido por
  funcionalidades reais.
- **A preocupação de fundo do usuário está correta em outro sentido**: o
  sistema **já possui** uma estrutura normalizada e correta para titularidade
  de direitos — a tabela `rights_holders` + `shares.rights_holder_id`
  (migrations `RegistryFieldsPhase1`/`RegistryRightsHoldersIdentifiers`,
  2026-06-01), com `RightsHoldersService`/`RightsHoldersController` dedicados.
  `works.detentores` é **texto livre legado, anterior a essa normalização**,
  que nunca foi migrado para a relação estrutural correta. Ver §11.4.

### 11.2 Contrato canônico de `works` — matriz completa

Fonte: `obra-schema.ts` (Zod) → `ObraFormModal.tsx` (submit real) →
`registro-musicas.mapper.ts::formToObraPayload` (payload real) →
`create-work.dto.ts` (DTO) → `entities.ts::WorkEntity` → migrations →
`report-form-contracts.ts::WORKS_CONTRACT` (leitura/exportação).

| Campo do formulário | Payload | DTO | Service/Entity | Migration | Tabela | PG Type | Nullable | Relação | Status | Decisão |
|---|---|---|---|---|---|---|---|---|---|---|
| tituloObra | titulo | titulo | titulo | InitialSchema | titulo | varchar(500) | NOT NULL | — | ATIVO | MANTER |
| generoMusical | genero | genero | genero | InitialSchema | genero | varchar(100) | NULL | — | ATIVO | MANTER |
| idioma | idioma | idioma | idioma | FormFieldColumns 07-12 | idioma | varchar(20) | NULL | — | ATIVO | MANTER |
| iswc | iswc | iswc | iswc | InitialSchema | iswc | varchar(20) | NULL | — | ATIVO | MANTER |
| codAbramus | cod_abramus | cod_abramus | cod_abramus | InitialSchema | cod_abramus | varchar(100) | NULL | — | ATIVO | MANTER (nome canônico único e real) |
| codEcad | cod_ecad | cod_ecad | cod_ecad | InitialSchema | cod_ecad | varchar(100) | NULL | — | ATIVO | MANTER |
| duracaoMin+Seg | duracao | duracao | duracao | FormFieldColumns 07-12 | duracao | varchar(20) | NULL | — | ATIVO | MANTER |
| instrumental | instrumental | instrumental | instrumental | Registry Phase1 | instrumental | varchar(10) | NULL | — | ATIVO | MANTER |
| criadaPorIA | criada_por_ia | criada_por_ia | criada_por_ia | FormFieldColumns 07-12 | criada_por_ia | boolean | NULL | — | ATIVO | MANTER |
| (tipoIA) | tipo_ia | tipo_ia | tipo_ia | FormFieldColumns 07-12 | tipo_ia | varchar(50) | NULL | — | ATIVO | MANTER |
| iaHarmonia/Melodia/Letra | ia_harmonia/melodia/letra | idem | idem | FormFieldColumns 07-12 | idem | jsonb | NULL | — | ATIVO | MANTER (forma fixa {ferramenta,prompt}, não é metadata genérico) |
| outrosTitulos | outros_titulos | outros_titulos | outros_titulos | FormFieldColumns 07-12 | outros_titulos | jsonb/array | NULL | — | ATIVO | MANTER |
| referenciasConexas | referencias_conexas | referencias_conexas | referencias_conexas | FormFieldColumns 07-12 | referencias_conexas | jsonb/array | NULL | — | ATIVO | MANTER |
| letraCompleta | letra_completa | letra_completa | letra_completa | FormFieldColumns 07-12 | letra_completa | text | NULL | — | ATIVO | MANTER |
| participantes[] | participantes | participantes | participantes | FormFieldColumns 07-12 | participantes | jsonb | NULL | fonte rica de autoria | ATIVO | MANTER — candidato a virar tabela relacional `work_participants` no futuro (recomendação, não executada) |
| situacao | status | status | status | InitialSchema | status | varchar | NOT NULL default | — | ATIVO | MANTER |
| (derivado de participantes) | compositores | compositores | compositores | InitialSchema | compositores | jsonb | NULL | derivado | ATIVO | MANTER — CANÔNICO, mas DERIVADO (não é fonte primária) |
| (derivado de participantes) | letristas | letristas | letristas | ? | letristas | jsonb/array | NULL | derivado | ATIVO | MANTER — CANÔNICO, DERIVADO |
| projetoId | projeto_id | projeto_id | projeto_id | InitialSchema | projeto_id | uuid | NULL | FK projects | ATIVO | MANTER |
| artistaId | artista_id | artista_id | artista_id | InitialSchema | artista_id | uuid | NULL | FK artists | ATIVO | MANTER |
| tipoObra | tipo_obra | tipo_obra | tipo_obra | FormFieldColumns 07-12 | tipo_obra | varchar(50) | NULL | — | ATIVO | MANTER |
| — (não é campo do form ativo) | — | compositor | compositor | InitialSchema | compositor | varchar(255) | NULL | — | LEGADO/bulk | MANTER COM JUSTIFICATIVA (lido por `catalog-metadata-validator`; aceito via bulk-import; editável no contrato de Reports) |
| — (não é campo do form ativo) | — | editora | editora | InitialSchema | editora | varchar(255) | NULL | — | LEGADO/bulk | MANTER COM JUSTIFICATIVA (exibido em `RegistroMusicas.tsx`; editável via Reports/bulk) |
| — (não é campo do form ativo) | — | (read-only) | co_compositores | InitialSchema | co_compositores | text | NULL | — | LEGADO read-only | MANTER COM JUSTIFICATIVA (exibido em Rights Monitoring; lido por automação e external-data-exchange) |
| — (não é campo do form ativo) | — | (read-only) | detentores | InitialSchema | detentores | text | NULL | — | LEGADO read-only | MANTER COM JUSTIFICATIVA (ver §11.4 — substituto estrutural já existe, mas não é usado aqui ainda) |
| — (não é campo do form ativo) | — | metadata (bulk) | metadata | InitialSchema | metadata | jsonb | default {} | — | NÃO ESCRITO pelo form ativo | MANTER (excluído explicitamente do contrato de Reports como "objeto jsonb interno bruto"; não há chave formal a extrair, pois nenhuma é gravada pelo fluxo ativo) |
| — | — | authors/shares (bulk) | — | — | — | — | — | relação real em `shares` | LEGADO/bulk | MANTER (canal de bulk-import para a mesma relação já modelada em tabela própria) |

### 11.3 `compositor` × `compositores` — classificação final

**Não são a mesma gravação duplicada.** São dois CANAIS DE ESCRITA
diferentes para o mesmo domínio semântico (autoria):

- `compositores` (plural, jsonb array) é **CANÔNICO** para o formulário
  interativo — sempre DERIVADO de `participantes` via
  `participantesToCompositoresLetristas()`, nunca digitado diretamente.
- `compositor` (singular, varchar) é **LEGADO**, nunca escrito pelo
  formulário interativo (confirmado: `formToObraPayload` não o inclui), mas
  ainda é um canal de escrita válido via bulk-import/API direta (aceito pelo
  DTO) e é lido por `catalog-metadata-validator.automation.ts`.

Como nenhum fluxo real grava os dois simultaneamente com o mesmo dado, **não
há redundância ativa a resolver por migration**. Decisão: **MANTER AMBOS**,
documentando a distinção de canal (interativo vs. bulk/legado) — não remover
`compositor` sem antes provar que nenhum import em massa o usa (não
verificado nesta rodada; ver §11.6, dívida remanescente).

Multiautoria (múltiplos compositores) já é modelada corretamente através de
`participantes` (jsonb rico, com `classeFuncao`/`percentual`/`link` por
pessoa) — não há hoje uma tabela associativa `work_composers` dedicada;
`participantes` cumpre esse papel. Formalizar `participantes` como tabela
relacional (`work_participants`) é uma recomendação arquitetural, não uma
correção desta rodada (decisão de produto, fora do escopo "correções
inequívocas").

### 11.4 `detentor(es)` / `holder(s)` / `titular(es)` — todas as ocorrências

Busca `grep -rniE "\bholder\b|\bholders\b|rights_holder(s)?|\btitular\b|\btitulares\b"` em
`apps/api/src` e `apps/web/src` encontrou **4 conceitos distintos**, nunca
confundidos entre si no código real:

| Ocorrência | Conceito real | Decisão |
|---|---|---|
| `works.detentores` (texto livre) | Titular(es) de direitos de uma obra, formato legado pré-normalização | MANTER COM JUSTIFICATIVA (uso real comprovado); recomendação não-executada: migrar para relação com `rights_holders` |
| `rights_holders` (tabela) + `shares.rights_holder_id` (FK) | Titular de direitos normalizado (Registry ABRAMUS/ECAD, Fase 2026-06-01) | MANTER — é a estrutura correta e já existente; não duplica `works.detentores` porque atende `shares`, não `works`, diretamente |
| `shares.titular_nome`/`titular_doc` | Identificação do titular de uma participação (share) específica, pré-FK `rights_holder_id` | MANTER — usado no backfill de `rights_holders`; convive com a FK nova |
| `artists.titularConta` ("Titular da Conta") | Nome do titular da conta bancária do artista (dado financeiro/cadastral, sem relação com direitos autorais) | MANTER — conceito totalmente diferente, sem qualquer sobreposição |
| `releases` "Titular do Copyright" (`lancamento.copyright`) | Titular do copyright de um lançamento — ver §11.5 | MANTER — corrigido nesta rodada (coluna própria) |

Nenhum desses usos foi inventado por mim nesta sessão; todos preexistem.
Nenhum agrupa conceitos diferentes na mesma coluna/JSON — cada um tem seu
próprio nome e sua própria tabela/coluna.

### 11.5 Auditoria de `metadata` — tabelas com violação real encontrada e corrigida

Cobertura desta rodada: `works`, `events`, `releases` (as três tabelas onde
havia evidência concreta de leitura/escrita ativa de `metadata` a partir de
formulários reais). **Não foi possível, no tempo desta rodada, varrer as
demais ~157 tabelas** — ver §11.6 para o que fica como dívida explícita.

| Tabela | Coluna metadata | Chaves formais gravadas (achadas) | Formulário de origem | Coluna canônica existente | Coluna nova necessária | Migração | Pode remover metadata? | Decisão |
|---|---|---|---|---|---|---|---|---|
| `works` | `metadata` jsonb | **nenhuma** — `formToObraPayload` nunca inclui `metadata` | `ObraFormModal.tsx` | — | nenhuma | não aplicável | Não (mantido para bulk/import genérico; contrato de Reports já o exclui explicitamente) | MANTER |
| `events` | `metadata` jsonb | `endereco`, `contato_local`, `valor_cache`, `publico_esperado`, `descricao`, `observacoes`, `status_legado` (lixo — já duplicava a coluna `status`), `participants` (grafia divergente de `participantes`) | `SchedulerFormModal.tsx` | `endereco`, `contato_local`, `valor_cache`, `publico_esperado`, `descricao`, `participantes` já existiam na entity (migration 07-12) mas **não estavam no DTO** (`observacoes` também já existia na entity sem DTO) | nenhuma (colunas já existiam) — só faltava o DTO | `events.dto.ts`/`events.service.ts` corrigidos nesta rodada (sem migration nova) | Sim, para os campos formais (metadata deixou de receber estes) | **CORRIGIDO NESTA RODADA** |
| `releases` | `metadata` jsonb | `isrc_global`, `notas_internas`, `observacoes` (mapeado de `notasDistribuicao`), `gravadora`, `copyright`, `genero`, `idioma`, `assets` (objeto: 7 subchaves fixas), `cronograma` (objeto: 3 subchaves fixas) | `LancamentoFormModal.tsx` (via `form-to-payload.mapper.ts`) | nenhuma existia | `isrc_global`, `notas_internas`, `observacoes`, `gravadora`, `copyright`, `genero`, `idioma`, `assets`, `cronograma` (9 colunas) | `20260718000010_ReleasesFormFieldColumns.ts` (criada, **não executada**) | Sim, para os campos formais | **CORRIGIDO NESTA RODADA** (migration criada + DTO + entity + service + frontend) |

Nota sobre `assets`/`cronograma`: mantidos como colunas jsonb **dedicadas e
nomeadas** (não dentro de `metadata` genérico), porque cada uma tem um
conjunto fixo e conhecido de subchaves (7 e 3, respectivamente) — o mesmo
padrão já usado em `releases.plataformas` (jsonb pré-existente na mesma
entity). Isso não viola a regra de 1-campo-1-coluna: a regra proíbe usar
`metadata` como despejo de campos formais **individuais**; um sub-registro
estruturado com nome e forma fixos, documentado, é uma exceção legítima
equivalente a uma relação 1:1, análoga à exceção de FK/child-table.

### 11.6 Colunas órfãs

Reaproveitado o resultado da auditoria estrutural programática (§6.7, script
`structural-audit.mjs`, 120 entities × 160 tabelas): nenhuma coluna órfã nova
foi introduzida pelas mudanças desta rodada (`releases` re-verificado após a
migration nova — 0 divergências entity↔migration). O inventário de colunas
órfãs pré-existente permanece o registrado em §6.7/§6.8 — não foi
reclassificado campo a campo (REMOVER/MIGRAR/DEPRECAR/MANTER) nesta rodada
por não ter sido o foco solicitado; fica como dívida explícita.

Achado adicional (não uma coluna órfã de banco, mas do mesmo espírito):
`CreateEventDto.ticketUrl` existe no DTO/entity mas nenhum campo do
`SchedulerFormModal.tsx` o envia atualmente. Decisão: **MANTER** — é uma
feature pendente de UI (não há evidência de que tenha sido descartada), não
um campo morto sem uso; não classificado como órfão porque está corretamente
declarado e mapeado no service, apenas ainda sem UI.

### 11.7 Migrations corretivas criadas nesta rodada

Apenas **uma** migration nova, **não executada**:

- `20260718000010_ReleasesFormFieldColumns.ts` — adiciona `isrc_global`,
  `notas_internas`, `observacoes`, `gravadora`, `copyright`, `genero`,
  `idioma`, `assets`, `cronograma` em `releases`. Timestamp posterior a M9
  (`20260718000009_FinancialOperationalBridges`), não colide com a sequência
  financeira da Fase 13A.

Nenhuma migration de remoção foi criada para `works` (`compositor`,
`co_compositores`, `detentores`, `editora`, `metadata`): a evidência coletada
prova uso real e ativo de todos — remover qualquer um deles quebraria
`catalog-metadata-validator`, `external-data-exchange.service`, a UI de
Rights Monitoring, ou o contrato oficial de Reports. Fabricar uma migration
de remoção sem essa prova violaria a própria regra de "não simular sucesso"
que motivou este mandato.

### 11.8 Testes criados

- `apps/api/src/modules/works/works-field-contract.spec.ts` (5 testes) —
  prova comportamentalmente, via `class-validator` com a mesma config do
  `ValidationPipe` global (`whitelist + forbidNonWhitelisted`), que
  `cod_abramus` é aceito e `codigo_abramus`/`codigo_entidade`/`cod_entidade`/
  `entity_code`/`holders`/`titulares` são rejeitados.
- `apps/api/src/database/form-field-dto-parity.spec.ts` (2 testes) — guarda
  estática que impede a entity ter coluna dedicada de formulário sem o DTO
  expor o mesmo campo (o bug real encontrado em `events.observacoes`).
- `apps/web/src/modules/catalog/services/registro-musicas.mapper.test.ts`
  (4 testes) — `formToObraPayload` nunca envia `metadata`/`compositor`/
  `editora`/`codigo_abramus`; `compositores`/`letristas` sempre derivados de
  `participantes`.
- `apps/web/src/modules/events/components/scheduler-form-metadata-guard.test.ts`
  (3 testes) — guarda estática: `SchedulerFormModal.tsx` não volta a montar
  `metadata[...]` a partir de campos formais.
- `apps/web/src/modules/releases/services/form-to-payload.mapper.test.ts`
  (5 testes) — `formToLancamentoPayload` nunca envia `metadata`; campos
  formais vão para colunas próprias; `assets`/`cronograma` só aparecem
  quando preenchidos.

Total: **19 testes novos**, todos executados e passando (`jest` para
backend, `vitest run` para frontend) nesta rodada.

### 11.9 Escopo não coberto nesta rodada (dívida explícita — transparência obrigatória)

- Varredura de `metadata`/`meta`/`extra_data`/`additional_data`/`details`/
  `payload`/`attributes`/`custom_fields` nas ~157 tabelas restantes.
- Varredura de duplicidade de colunas nas 160 tabelas usando os pares de
  exemplo do mandato (titulo×title×nome, tipo×type, phone×telefone,
  artist_id×artista_id, etc.) além dos já verificados
  (compositor×compositores, codigo_entidade×codigo_abramus,
  titular×detentor).
- Reclassificação campo-a-campo (REMOVER/MIGRAR/DEPRECAR/MANTER) de cada
  coluna órfã já listada em §6.7/§6.8.
- Confirmação definitiva de que nenhum import em massa grava
  `works.compositor` (singular) hoje — recomendado antes de qualquer decisão
  futura de descontinuar esse campo.
- Migração arquitetural de `works.detentores` (texto livre) para uma relação
  estruturada equivalente a `shares.rights_holder_id → rights_holders` —
  decisão de produto, não executada.

## 12. Rodada 4 — normalização de `participantes` e remoção de órfãos comprovados (2026-07-18)

O usuário rejeitou a conclusão de §11 de "manter `detentores`/`co_compositores`
com justificativa" e de manter `participantes` em jsonb, exigindo prova mais
rigorosa (rastrear TODOS os writers, não só os readers) antes de aceitar
qualquer "manter". Nova investigação, mais estrita, mudou a decisão:

### 12.1 `works.detentores` e `works.co_compositores` — reclassificados de MANTER para REMOVIDOS

Prova de que **nenhum writer ativo existe** para nenhuma das duas colunas:
- Sem input no formulário ativo (`grep detentor` em `ObraFormModal.tsx`/
  `obra-schema.ts` retorna zero).
- Ausentes de `CreateWorkDto`/`UpdateWorkDto` — a API não aceita gravação
  direta.
- `report-form-contracts.ts::WORKS_CONTRACT` marca ambas `ro(...)`
  (`importable: false`) — o pipeline de bulk-import (`import-mapper.service.ts`,
  filtro `f.importable !== false`) também nunca as grava.
- Único uso real encontrado era LEITURA (`external-data-exchange.service.ts`,
  `RightsMonitoring.tsx`) de um valor que nunca é escrito — sempre `null`.

Conclusão: são colunas órfãs por definição do próprio mandato ("sem uso ativo
comprovado em formulário/payload/DTO/service"), não "legado com justificativa".
Removidas na migration `WorkParticipantsNormalization20260718000011`, com
validação fail-fast que aborta se houver dado remanescente (não descartado
cegamente). Todos os 4 leitores mortos foram corrigidos para não referenciá-las
mais: `external-data-exchange.service.ts` (removeu `co_composers`/`holders` do
payload externo — não havia substituto real e nada consumia essas chaves),
`catalog-metadata-validator.automation.ts` (SELECT e `toComposers()` ajustados),
`report-form-contracts.ts` (`ro()` removidos, motivo documentado em
`excludedFormFields`), `RightsMonitoring.tsx`/`ExecucaoDetailModal.tsx`/
`catalog-lookup.ts` (deixaram de ler/exibir os dois campos).

### 12.2 `works.participantes` normalizado em `work_participants`

`participantes[]` é uma lista de registros com forma fixa e conhecida
(`{id, nome, classeFuncao, link, percentual}`) — por definição do mandato,
uma coluna jsonb não pode representar isso; vira tabela filha.

Criada `work_participants` (mesma migration): `id uuid PK` (preserva o id
gerado no cliente — round-trip estável), `tenant_id`, `work_id` (FK
`ON DELETE CASCADE`), `nome`, `classe_funcao`, `link`, `percentual`
(`numeric(6,3)`, CHECK 0–100), `ordem` (preserva a ordem de exibição do
formulário), `created_at`/`updated_at`. RLS habilitada com a policy
`tenant_isolation` (mesmo padrão de `20260613000008`). Sem FK para `artists`:
`ParticipanteForm` não tem `artista_id` — o formulário real aceita
participante não cadastrado, então `nome` é texto livre por design, não uma
lacuna de modelagem.

`WorksService` foi reescrito para traduzir a relação de forma transparente
para quem consome a API: `create()`/`update()` persistem os itens de
`participantes[]` como linhas (delete-then-insert no update); `findById()`/
`list()` reidratam o array no MESMO formato que o frontend sempre recebeu
(`{id, nome, classeFuncao, link, percentual}`), então **nenhuma mudança foi
necessária em `ObraFormModal.tsx` ou no mapper do frontend** — o contrato de
API é idêntico, só o armazenamento interno mudou.

Migração de dados (na própria migration, antes de dropar a coluna): 1 INSERT
por item do array, com `ordinality` preservando a ordem; fail-fast aborta se
algum item não tiver a chave `nome`; uma segunda verificação compara
`COUNT` de origem × destino e aborta se não baterem — a coluna só é
efetivamente removida depois de comprovado que nenhum item foi perdido.
`down()` reconstrói o jsonb a partir das linhas (`jsonb_agg`).

### 12.3 `compositor` e `editora` — reconfirmados MANTER (não reclassificados)

Ao contrário de `detentores`/`co_compositores`, estes **têm** writer real:
`CreateWorkDto` os aceita, `WORKS_CONTRACT` os marca `col()` (importável via
bulk-import de Reports), e são lidos por `catalog-metadata-validator`. Nenhuma
mudança.

### 12.4 Migration nova

`20260718000011_WorkParticipantsNormalization.ts` — **não executada**, timestamp
posterior à anterior (`20260718000010`). Cria `work_participants`; migra dados
de `works.participantes` com validação de forma e contagem; remove
`works.participantes`, `works.detentores`, `works.co_compositores` só depois
de as validações passarem. `down()` recria as 3 colunas e reconstrói o jsonb.
Não usa `CASCADE` em nenhum `DROP`.

### 12.5 Testes novos desta rodada

- `apps/api/src/modules/works/works.service.spec.ts` — 5 testes novos: `create()`
  não envia `participantes` como coluna; persiste cada item como linha própria
  com `tenant_id`/`ordem` corretos; `findById()` reidrata no formato exato do
  frontend; `update()` substitui (delete+insert); `update()` sem o campo não
  mexe nas linhas existentes.
- `apps/api/src/modules/works/works-field-contract.spec.ts` — 2 testes novos:
  `detentores`/`co_compositores` rejeitados pelo DTO; `participantes[]` ainda
  aceito (mapeado para a relação pelo service).
- `apps/api/src/database/work-participants-normalization.spec.ts` (novo, 9
  testes) — guarda estática: `WorkEntity` não redeclara as 3 colunas
  removidas; `WorkParticipantEntity` tem as colunas reais; a migration tem as
  validações fail-fast, não usa CASCADE, e tem `down()` honesto.
  Durante a escrita deste teste foi encontrado e corrigido um bug real no
  helper `entityBlock()` (usado também em `form-field-dto-parity.spec.ts`):
  `entities.ts` usa CRLF, e `indexOf('\n}\n')` nunca casava, fazendo o "bloco"
  de uma entity vazar para o arquivo inteiro — mascarado até então porque os
  únicos asserts existentes eram positivos (presença), não negativos.
  Corrigido com um regex tolerante a `\r?\n`.

Total: 16 testes novos nesta rodada (25 novos = 19 da rodada anterior + 16,
descontado que nenhum teste anterior foi removido). Todos executados e
passando: `jest` backend (37/37 nos arquivos de works + parity), suíte
completa do backend sem regressão introduzida por esta rodada (1 falha
pré-existente e não relacionada, `supabase-data-api-hardening.migration.spec.ts`,
commit `f840fc7f`, anterior a toda esta sessão).

## 13. Rodada 5 — audiovisual (1º item da ordem obrigatória) (2026-07-18)

Confirmado o CRÍTICO já apontado em rodadas anteriores (§6.2), desta vez com
correção completa: `AudiovisualProjectFormModal.tsx` envia o payload direto
para `api.post`/`api.patch` (`audiovisual.service.ts`), sem nenhum mapper
intermediário. `CreateAudiovisualProjectDto` não declarava 15 dos ~22 campos
do formulário real. Com `ValidationPipe({ whitelist: true,
forbidNonWhitelisted: true })`, **toda** criação/edição de produção
audiovisual retornava 400 — confirmado, não hipotético.

### 13.1 Duas divergências de nome resolvidas SEM criar coluna nova

- `music_id` (form) → a mesma relação já modelada pela FK existente
  `phonogram_id` (`audiovisual_projects.phonogram_id`, já em
  `CreateAudiovisualProjectDto`). Corrigido no frontend, não no banco.
- `budget`/`real_cost` (form) → todo ponto de leitura do frontend usa os
  rótulos "Orçamento Previsto"/"Custo Real", e
  `projects.service.ts::dashboard()` já soma `budget_estimated`/
  `budget_actual` **desta mesma tabela** (linha 136: `qb.select([...,
  'p.budget_estimated', 'p.budget_actual', ...])`). Se o formulário
  continuasse gravando em colunas novas `budget`/`real_cost`, o dashboard
  financeiro ficaria zerado silenciosamente após a correção do 400 — bug pior
  que o original. Corrigido no frontend (`budget_estimated`/`budget_actual`),
  com fallback de leitura `project.budget_estimated ?? project.budget` em
  todos os 6 pontos de exibição, para não quebrar dados já existentes.

### 13.2 Um caso de rename já em andamento, identificado e completado

Todo ponto de leitura do frontend já fazia
`project.shooting_date ?? project.recording_date` — prova de que o produto
já tratava `shooting_date` como nome canônico novo e `recording_date` como
fallback legado, sem que o backend tivesse a coluna nova ainda. `shooting_date`
criada como coluna nova; `recording_date` mantida (não removida — pode ter
dado histórico e nenhuma prova de que esteja descontinuada).

### 13.3 Campos genuinamente novos (sem coluna equivalente, sem evidência de duplicação)

`music_title`, `artist_name`, `format`, `videomaker`, `editor`, `location`,
`capture_status`, `editing_status`, `approval_status`, `pre_release_date`,
`release_date`, `concept`, `observations`, `final_status`. `release_date` foi
mantida DISTINTA de `publish_date` (que continua sendo escrita
automaticamente por `transitionStatus()` ao mover para "published") — não há
evidência de que sejam o mesmo conceito; `release_date` é a data planejada.
`concept` foi mantida DISTINTA de `objective` (exibido em outro ponto da UI,
sem evidência de sobreposição). Nenhuma das duas foi mesclada sem prova.

### 13.4 Correção adicional: `name` duplicado

O payload enviava `title` e `name` com o MESMO valor (`form.music_title`).
`name` não é coluna real — removido do payload; `title` já cobre o dado.

### 13.5 Migration, DTO, entity, testes

- `20260718000012_AudiovisualProjectsFormFieldColumns.ts` — 15 colunas novas
  em `audiovisual_projects`, **não executada**.
- `CreateAudiovisualProjectDto`/entity atualizados; `capture_status` validado
  como string simples (não `@IsIn`) para não introduzir uma trava mais
  rígida do que a já existente nos demais campos de status deste DTO.
- `buildAudiovisualProjectPayload` extraída para função pura exportada
  (mesmo padrão de `formToObraPayload`/`formToLancamentoPayload`), tornando
  o contrato testável sem renderizar o componente.
- Testes novos: `audiovisual.dto.spec.ts` (+3, reproduz o payload real e
  prova que era rejeitado antes da correção) e
  `AudiovisualProjectFormModal.payload.test.ts` (5, novo).
- Suíte audiovisual backend: 60/60 (32 + 28). Frontend: suite completa sem
  regressão.

### 13.6 Nota sobre commits desta rodada

`entities.ts` e `audiovisual.dto.ts` já tinham alterações não commitadas e
não relacionadas (reconciliação de enums "Fase 4": `TASK_STATUSES`,
`CAPTURE_STATUSES`, `ASSET_KINDS`, `SeedDeliverableDefaultsDto`, entre
outras) — mesmo padrão já registrado em §11 para outros arquivos. Meus hunks
foram isolados e commitados separadamente; as mudanças pré-existentes não
relacionadas permanecem no working tree, não reivindicadas nos meus commits.
`audiovisual.dto.spec.ts` está `untracked` no git (arquivo inteiro, de uma
fase anterior desta mesma sessão) — meus testes novos ali ficam
temporariamente fora de commit pela mesma razão; continuam presentes e
passando no working tree.

Rodando a suíte completa após esta rodada, `report-entity-definition.service.spec.ts`
quebrou (mesmo teste de paridade label↔coluna do §11) para as 13 colunas
novas de `audiovisual_projects`. Adicionados os 13 labels pt-BR
correspondentes em `field-labels.pt-br.ts` — mesmo arquivo entrelaçado com
mudanças pré-existentes já registrado em §11/§13.6, então este ajuste também
fica fora dos commits, presente e verificado no working tree.

## 14. Rodada 6 — projects, execução real no DEV (2026-07-18)

Segundo CRÍTICO confirmado da ordem obrigatória. Mais severo que audiovisual:
zero sobreposição de nomes entre o payload real e o DTO.

### 14.1 Fluxo real confirmado

`ProjetoFormModal.tsx` → `useProjetos()` → `storage.create("projetos", ...)`
→ `TABLE_ENDPOINT["projetos"] = "/projects"` → `CreateProjectDto`. Payload
real: `titulo, tipo, status, observacoes, descricao, genero, artista_id,
musicas[]`. DTO antigo: `title, type, artistId, budget, currency, startsAt,
deadlineAt, releasedAt, metadata` — zero campos em comum. Com
`forbidNonWhitelisted`, toda criação/edição de projeto retornava 400.

Achado adicional: mesmo que o DTO antigo fosse aceito, `ProjectsService`
fazia spread direto (`...dto`) sobre `ProjectEntity`, cuja coluna física já
era `nome` (não `title`) — os campos do DTO antigo nunca teriam persistido
de qualquer forma, por dupla causa independente.

### 14.2 Contrato canônico — sem inventar vocabulário

Usados os nomes reais do formulário ativo, como exigido: `titulo, tipo,
status, observacoes, descricao, genero, artista_id`. Coluna `nome` renomeada
para `titulo` (RENAME COLUMN — DEV com 0 linhas de negócio, sem risco de
perda). Nenhuma duplicidade `titulo`/`title`/`nome` mantida — única coluna
canônica.

### 14.3 musicas[] normalizada — 2 writers reais corrigidos

`musicas[]` (nome, soloFeat, originalRemix, instrumental, duracaoMin/Seg,
genero, idioma, compositores[], interpretes[], produtores[], letra,
audioUrl) era serializada com `JSON.stringify()` dentro de `descricao` —
encontrados **dois** writers reais com o mesmo anti-padrão:
`ProjetoFormModal.tsx` (formulário principal) e o import em massa (XLSX) em
`Projetos.tsx`. Ambos corrigidos.

Pesquisados nomes de tabela equivalentes existentes (`project_tracks`,
`project_songs`, `tracks`, `songs`, `release_tracks`) — nenhum encontrado;
criada `project_tracks` (colunas reais extraídas de `MusicaData`:
`nome, solo_feat, original_remix, instrumental, duracao_min, duracao_seg,
genero, idioma, letra, audio_url, ordem` — `arquivoAudio` não persistido,
confirmado local-only pelo próprio comentário de `musica-helpers.ts`).

`compositores[]`/`interpretes[]`/`produtores[]` têm a mesma estrutura (nome
livre, sem vínculo a artista cadastrado) diferindo só pelo papel — modelados
em uma única tabela `project_track_participants` com `role IN ('compositor',
'interprete', 'produtor')` (CHECK), não três tabelas nem um enum inventado.

`ProjectsService` reidrata em `projeto.musicas` no mesmo formato que o
frontend sempre consumiu (`getMusicaInfo`/`getFirstMusicaInfo`/
`parseMusicasFromProjeto` em `musica-helpers.ts`, `ProjetoViewModal.tsx`,
`Projetos.tsx`, `RegistroMusicas.tsx`) — nenhuma mudança de contrato de API,
só a origem interna dos dados mudou.

### 14.4 Arquivos órfãos removidos

`apps/api/src/modules/projects/entities/project.entity.ts` e
`repositories/project.repository.ts`: uma segunda classe `@Entity('projects')`
com apenas `id/created_at/updated_at`, nunca importada por
`projects.module.ts`/`projects.controller.ts` — confirmado morto por busca
exaustiva antes da remoção. Removida também a entrada correspondente em
`repositories-tenant-isolation.spec.ts` (testava o repository morto).

### 14.5 Migration, testes, execução

`20260718000013_ProjectsFormFieldAlignment.ts` — rename `nome→titulo`, novas
colunas `observacoes`/`genero`, cria `project_tracks`/
`project_track_participants` com RLS, migra `descricao` JSON legada com
validação de forma e contagem antes de limpar a coluna (defensivo — DEV não
tinha nenhum dado a migrar). **Executada no DEV nesta rodada** — ver §14.6.

Testes novos: `projects.dto.spec.ts` (4 — payload real aceito; nomes em
inglês do DTO antigo rejeitados), `projects.service.spec.ts` (6 —
persistência dos campos corretos, musicas não vira coluna direta, round-trip
completo de musicas via project_tracks, reidratação no formato do frontend,
substituição delete+insert no update), `ProjetoFormModal.metadata-guard.test.ts`
(3) e `Projetos.metadata-guard.test.ts` (2) — guardas estáticas contra
regressão do `JSON.stringify` em `descricao`.

Regressão real encontrada rodando a suíte completa (mesma classe de bug já
visto em §12/§13): `entity-metadata.service.spec.ts` falhou por
`project_tracks`/`project_track_participants` sem classificação — corrigido
(mesmo arquivo entrelaçado, fora do commit, presente no working tree).

Suíte completa final desta rodada: backend 1182/1185 (3 falhas
pré-existentes confirmadas, não relacionadas); frontend 49/49 arquivos,
452/452 testes.

### 14.6 Execução real autorizada no DEV (proibição revogada para este ambiente)

`pnpm env:check` confirmado (ref `rypnevnfipygyhysqpdo`) antes e imediatamente
antes da conexão. Runner (`tmp-f13b-runner.ts`, temporário, não commitado)
executado como `musicos_migrator`, `transaction: 'each'`.

**1ª tentativa**: 92 legadas (75–92) + M0–M9 + releases (103 migrations)
aplicadas com sucesso; `WorkParticipantsNormalization20260718000011` falhou
(`operator does not exist: record ->> unknown` — bug real de sintaxe SQL,
`WITH ORDINALITY` sem lista de colunas) e foi revertida pela própria
transação da migration (nenhuma migration commitada foi perdida).

Bug corrigido (commit `c247cd8b`, ver §14.6 acima) e a cadeia reexecutada:
**106/106 migrations registradas com sucesso** — nenhuma falha.

**Comprovação física (`information_schema`, consultas reais no DEV):**
- `works`: `participantes`/`detentores`/`co_compositores` confirmadas
  **ausentes**. `work_participants`: 10 colunas presentes com tipos corretos.
- `projects`: `titulo` (renomeada de `nome`), `observacoes`, `genero`
  confirmadas presentes. `project_tracks`: 15 colunas. `project_track_participants`:
  7 colunas.
- `audiovisual_projects`: 15/15 colunas novas confirmadas presentes.
- `releases`: 9/9 colunas novas confirmadas presentes.
- `events`: 7/7 colunas confirmadas presentes.
- RLS habilitada (`rls_enabled=true`) e policy `tenant_isolation` presente
  em `work_participants`, `project_tracks`, `project_track_participants`.
- FKs confirmadas: `project_track_participants.project_track_id →
  project_tracks.id`, `project_tracks.project_id → projects.id`,
  `work_participants.work_id → works.id`, todas `ON DELETE CASCADE`.

**Teste de round-trip real (transação `BEGIN`/`ROLLBACK`, nunca commitado,
contexto de tenant via `set_config('app.current_tenant_id', ...)`):**
criado 1 projeto (titulo/tipo/status/observacoes/descricao/genero) + 2
faixas + 3 participantes (compositor/interprete/produtor) → round-trip via
SELECT confirma todos os campos e contagens → `descricao` contém só texto
(não é array JSON) → `metadata` vazio (`{}`) → Tenant B não enxerga o
projeto do Tenant A (RLS, 0 linhas) → update parcial preserva
titulo/descricao → DELETE do projeto propaga CASCADE para tracks e
participantes (0/0 restantes). Testes adicionais de INSERT real (mesma
transação com rollback) confirmaram os campos novos de
`audiovisual_projects`, `works`/`work_participants`, `releases` e `events`
funcionando fim a fim. **ROLLBACK executado em todos os casos — zero dado
sintético persistido.**

**Contagem final de migrations**: 106 (92 legadas + 10 financeiras + 1
releases + 1 work_participants + 1 audiovisual + 1 projects), todas
registradas em `musicos360_migrations` no DEV.

**MAIN**: nenhuma conexão, query ou comando foi executado contra
`sxmfeocztlztvpdnxayk` nesta sessão — apenas o ref DEV
(`rypnevnfipygyhysqpdo`) foi usado, confirmado por `env:check` antes de cada
conexão.

## 15. Rodada 7 — settings/usuários, M9 e verificação de marketing/tarefas (2026-07-18)

### 15.1 settings/usuários — bug real confirmado e corrigido

`UsuarioFormModal.tsx` → `useUsuarios()` → `storage.update("usuarios", id,
{full_name, phone, cargo})` → `PATCH /users/:id` → `UpdateUserDto`, que só
aceitava `fullName`/`role` (camelCase, convenção já consistente neste
módulo) — `full_name` e `cargo` eram sempre rejeitados pelo whitelist;
`phone` não tinha coluna nem campo de DTO em nenhuma camada.

Corrigido no hook (traduz `full_name`→`fullName`, `cargo`→`role` no payload
HTTP, sem mudar a API pública do hook) e no backend (`phone` adicionado em
`org_members` + DTO + service). Migration `OrgMembersPhoneColumn20260718000014`
**executada no DEV** — coluna `phone` confirmada fisicamente via
`information_schema` (107/107 migrations).

**Achado não resolvido nesta rodada, documentado para decisão de produto**:
os 8 valores de `NIVEIS_ACESSO` do formulário (`admin_master`, `ar_gestao`,
`financeiro_contabil`, `juridico`, `marketing`, `artista`, `colaborador`,
`leitor`) foram comparados com os slugs de role reais e seedados no DEV
(`admin, artist, artista, colaborador, comercial, editor, financial,
juridico, manager, marketing, marketing_manager, owner, produtor, radio,
rh_manager, super_admin, tenant_owner, tv, viewer, accounting`). Apenas 4
batem exatamente (`juridico`, `marketing`, `artista`, `colaborador`); os
outros 4 não têm correspondência direta (`admin_master`→`admin` ou
`super_admin`? `financeiro_contabil`→`accounting` ou `financial`?
`leitor`→`viewer`; `ar_gestao` não tem equivalente algum). Corrigir apenas
o nome da chave (`cargo`→`role`, já feito) NÃO resolve esse mapeamento —
requer decisão de produto sobre qual slug real cada opção da UI deve
assumir. Não resolvido às cegas.

Também identificado, não investigado a fundo nesta rodada: `useUserSettings.ts`/
`Perfil.tsx` (fluxo de autoatendimento do próprio usuário) grava
`full_name`/`phone`/`cargo`/`setor` num objeto `metaUpdate` — parece ser um
caminho de escrita SEPARADO do fluxo administrativo (`Usuarios.tsx`/
`UsuarioFormModal.tsx`) já corrigido aqui, possivelmente via metadata do
Supabase Auth em vez de `org_members`. Fica como escopo não coberto.

### 15.2 M9 — financial_project_id mapeado

`FinancialOperationalBridges20260718000009` (já executada) criou
`financial_project_id` (FK composta tenant-safe, `RESTRICT`) em
`audiovisual_projects` e `marketing_projects`, mas nenhuma das duas
entities TypeORM mapeava a coluna — phantom column confirmada pelo script
de auditoria estrutural. Corrigido (mapeamento puro, sem migration nova —
a coluna já existe desde M9). Nenhum campo de DTO exposto: a própria
migration documenta que não há associação automática (FK existe para uma
integração futura definir).

### 15.3 marketing/tarefas — investigado, nenhum bug encontrado

`marketing_project_id` já está corretamente mapeado em entity + DTO
(`CreateMarketingTaskDto.marketingProjectId`). `task_key` é gerado
internamente pelo backend (`manual:${randomUUID()}` em
`marketing-tasks.service.ts`, ou derivado de templates em
`marketing-projects.service.ts`/`marketing-strategy.service.ts`) — não é
campo de formulário, por isso corretamente ausente do DTO. Busca exaustiva
não encontrou nenhum formulário interativo de criação de tarefa de
marketing no frontend (tarefas são geradas a partir de templates/
estratégias, não digitadas por um usuário) — não há, portanto, o padrão de
bug "formulário envia campo que o DTO rejeita" neste domínio. Nenhuma
correção necessária; não fabricada.

### 15.4 Migrations executadas nesta rodada

`20260718000014_OrgMembersPhoneColumn` — executada e confirmada
fisicamente. Nenhuma outra migration necessária (financial_project_id já
existia desde M9; marketing/tarefas não precisava de mudança).

**Contagem final de migrations: 107** (106 da Rodada 6 + 1 nova).

## 16. Rodada 8 — generalização de entidades de gestão coletiva; recusa técnica de reordenação física de colunas (2026-07-18)

### 16.1 Correção técnica: ordem física de colunas não é uma questão de correção de dados

Solicitado reconstruir fisicamente as tabelas para que a `ordinal_position`
das colunas acompanhe a ordem visual dos campos no formulário. **Não
executado.** Motivo, com evidência: `pg`/TypeORM (100% dos services deste
projeto) acessam colunas por nome, nunca por posição; os 5 usos de
`SELECT *` do backend (`audit.interceptor.ts`, `rbac-mutation.service.ts`,
`billing-enforcement.service.ts`) também retornam objetos indexados por
nome via o driver `pg`. `ordinal_position` não é lida por nenhuma query,
FK, índice, trigger ou policy deste sistema. Reordenar fisicamente exigiria
recriar cada tabela (novo `CREATE TABLE`, copiar dado por dado, reconstruir
PK/FK/índices/triggers/RLS/policies/grants) — a operação de maior risco
real do schema, para ganho funcional zero. Isso corresponde exatamente à
condição de parada "risco real de perda de dados" já definida em mandato
anterior desta sessão. A ordem canônica dos campos permanece documentada
nesta auditoria (por domínio); novas colunas continuam sendo adicionadas
respeitando a ordem do formulário (já era a prática desde a Rodada 1).

### 16.2 cod_abramus/cod_ecad — generalizados sem quebrar o que já funciona

Confirmado por evidência que a plataforma **já tinha decidido** generalizar
o vínculo com entidades de gestão coletiva: `external_identifiers`
(migration `RegistryRightsHoldersIdentifiers`, 2026-06-01) já existe, com
CHECK cobrindo `provider IN ('ABRAMUS','ECAD','CISAC','IFPI','PRO_MUSICA',
'ISRC','INTERNAL','OTHER')` e enums TS (`SocietyName`) já incluindo UBC,
SBACEM, AMAR, SICAM, SOCINPRO, ASSIM. Código real e ativo
(`society-payload-builder.service.ts`) já converte
`work.cod_abramus`/`cod_ecad` para esse formato genérico on-the-fly. O que
faltava era só migrar os dados legados — feito nesta rodada
(`20260718000015_BackfillLegacySocietyCodesToExternalIdentifiers`,
executada e verificada no DEV, 108/108).

**Não removidas** as colunas `cod_abramus`/`cod_ecad` de `works`/
`phonograms` nesta rodada: são o único campo exposto no formulário
interativo ativo (`ObraFormModal.tsx`), no contrato oficial de Reports
(`WORKS_CONTRACT`) e na integração real com a API externa da ABRAMUS
(`abramus.service.ts`, `RegisterAbramusWorkDto`). Removê-las exige
redesenhar o formulário para suportar múltiplas entidades por obra (hoje
são 2 campos fixos; generalizar significa uma lista dinâmica
entidade+código) — decisão de produto/UX que não foi tomada
unilateralmente. Nenhuma coluna nova por sociedade foi criada
(`cod_ubc`/`cod_socinpro`/etc. permanecem proibidas, consistente com a
regra).

### 16.3 Escopo não coberto nesta rodada

Auditoria exaustiva de finalidade comprovada para as 108 migrations/~160
tabelas (matriz completa tabela-a-tabela com writer/reader/volume/decisão)
não foi refeita do zero nesta rodada — reaproveita o levantamento já feito
em §6.7/§6.8 e as remoções já executadas (`works.participantes`/
`detentores`/`co_compositores`). Reconstrução do formulário de artistas
para redesenhar o fluxo de avatar/upload como lista multi-entidade não foi
abordada (é uma mudança de UX, não uma correção de contrato).

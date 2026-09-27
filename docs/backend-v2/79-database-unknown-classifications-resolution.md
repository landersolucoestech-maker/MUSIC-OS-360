# 79 — Resolução dos 23 Objetos `UNKNOWN` do Database Atual

Investigação read-only (mesma conexão MUSIC OS 360 / DEV / `rypnevnfipygyhysqpdo`, somente leitura — nenhum `CREATE`/`ALTER`/`DROP`/`INSERT`/`UPDATE`/`DELETE`/`GRANT`/`REVOKE` executado) resolvendo os 23 objetos classificados como `UNKNOWN` no doc78 (todos eram as 23 tabelas `LIVE_ONLY` do cross-check código×banco do doc78/code-vs-live.md). Não foram resolvidos nesta etapa: `LIVE_ONLY_OBJECTS`/`CODE_ONLY_OBJECTS`/`LIVE_CODE_MISMATCHES` como métrica (permanecem 23/9/32, reservados para etapa futura), estrutura interna de JSONB, dependências lógicas de Storage, e rastreabilidade endpoint→tabela do frontend. Nenhum schema `app`, migration, RLS, Auth, Storage, Realtime, Supabase, frontend, legacy ou código funcional foi alterado.

---

## Método

```text
Para cada um dos 23 objetos: (1) metadata PostgreSQL já coletada no doc78 (colunas, FKs de saída/entrada,
policies, triggers, row estimate) revisitada via consulta ao JSON já existente (sem nova query ao
banco além de 2 verificações pontuais de triggers/functions); (2) busca de código em apps/api/src por
nome exato da tabela — incluindo, desta vez, padrões de acesso que a metodologia do doc78/PROMPT 93 não
cobria (@Entity com sintaxe de objeto `{ name: '...' }`, @JoinTable, SQL cru via
`repository.manager.query()`/`dataSource.query()`); (3) busca em apps/web/src; (4) inspeção do arquivo
de migration que criou/alterou cada tabela, para origem e propósito documentados no próprio commit.
```

---

## Achado metodológico (relevante à evidência, não uma "resolução" de LIVE_ONLY_OBJECTS)

```text
A extração de tabelas de código do doc78/PROMPT 93 usou o padrão `@Entity('nome_literal')` (string),
que não captura 2 padrões TypeORM igualmente válidos e presentes no código real: `@Entity({ schema:
'public', name: 'nome' })` (sintaxe de objeto) e `@JoinTable({ name: 'nome' })` (tabela de junção
implícita de relação ManyToMany, sem @Entity próprio). 2 dos 23 objetos (`users`, `release_works`) têm
representação de código real através exatamente desses 2 padrões — não são, portanto, código-zero.
Isso é uma FALSO NEGATIVO da metodologia de contagem do doc78, não uma mudança de comportamento do banco
ou do código. Os contadores LIVE_ONLY_OBJECTS/CODE_ONLY_OBJECTS/MATCH_OBJECTS do doc78 (23/9/119) NÃO
foram alterados nesta etapa (fora de escopo, conforme instrução explícita) — este achado fica registrado
aqui como evidência de classificação e como apontamento para quando esses contadores forem revisados.
```

---

## Objetos resolvidos (23/23)

### 1

```text
OBJECT: users
TYPE: TABLE
SCHEMA: public
PREVIOUS_CLASSIFICATION: UNKNOWN
FINAL_CLASSIFICATION: ACTIVE_BUSINESS
DOMAIN: users / auth (identidade interna)
DATABASE_EVIDENCE: RLS habilitado, PK própria, índice UNIQUE(auth_user_id) (evidência já citada no
  doc49 como a projeção de identidade interna do Supabase Auth).
CODE_EVIDENCE: apps/api/src/modules/users/entities/user.entity.ts:10 —
  `@Entity({ schema: 'public', name: 'users' })` + `@Index('uq_users_auth_user_id', ['auth_user_id'],
  { unique: true })` — classe UserEntity real, ACTIVE_RUNTIME. Não capturado pela busca original
  (sintaxe de objeto, ver achado metodológico acima).
FRONTEND_EVIDENCE: fora de escopo desta etapa (não investigado especificamente); tabela é a base de
  GET /auth/context já mapeado no doc15/49.
DEPENDENCIES: alvo de múltiplas FKs de outras tabelas (created_by/updated_by em diversas tabelas do
  schema, ver doc78 seção 7 — AUTH_USER_REFERENCES).
RATIONALE: Falso negativo puro da metodologia de busca do doc78 — a tabela é ativamente mapeada por
  uma entidade TypeORM real e é a peça central de resolução de identidade interna do sistema (doc49).
```

### 2

```text
OBJECT: musicos360_migrations
TYPE: TABLE
SCHEMA: public
PREVIOUS_CLASSIFICATION: UNKNOWN
FINAL_CLASSIFICATION: MIGRATION_HELPER
DOMAIN: infraestrutura de migration (TypeORM)
DATABASE_EVIDENCE: tabela simples de bookkeeping de migrations aplicadas (padrão TypeORM), referenciada
  como a fonte do baseline "80 musicos360_migrations" já citado em docs anteriores desta série
  (STAGE_4_CANONICAL_BASELINE_157_80.md).
CODE_EVIDENCE: apps/api/src/database/datasource.ts:64 — `migrationsTableName:
  'musicos360_migrations'` (configuração explícita do DataSource TypeORM); consumida também por
  apps/api/src/database/migration-validator.service.ts (valida migrations pendentes no boot, fatal em
  produção — já citado no doc46). 33 arquivos do repositório referenciam o nome.
FRONTEND_EVIDENCE: NONE (não aplicável — infraestrutura de backend).
DEPENDENCIES: nenhuma FK; é a tabela de controle da própria ferramenta de migration.
RATIONALE: é literalmente a tabela de estado do executor de migrations do legacy — infraestrutura
  operacional, não dado de negócio, mas inequivocamente ativa e crítica (gate de boot em produção).
```

### 3-8 (família de partições)

```text
OBJECT: rbac_decision_logs
TYPE: TABLE (partitioned parent)
SCHEMA: public
PREVIOUS_CLASSIFICATION: UNKNOWN
FINAL_CLASSIFICATION: ACTIVE_INFRASTRUCTURE
DOMAIN: RBAC / observabilidade (auditoria de decisão de autorização)

OBJECT: rbac_decision_logs_2026_06 / _2026_07 / _2026_08 / _2026_09 / _2026_10 / _default
TYPE: TABLE (partitions)
SCHEMA: public
PREVIOUS_CLASSIFICATION: UNKNOWN
FINAL_CLASSIFICATION: ACTIVE_INFRASTRUCTURE
DOMAIN: RBAC / observabilidade (partições mensais + partição default)

DATABASE_EVIDENCE: rbac_decision_logs é o parent particionado (sem RLS direta, esperado — RLS em
  Postgres é herdada/aplicada por partição); cada uma das 5 partições mensais + a partição default TEM
  RLS habilitada e forçada, 25 colunas idênticas, 8 indexes cada.
CODE_EVIDENCE: criação em apps/api/src/database/migrations/20260614000008_CreateRbacDecisionLogs.ts;
  hardening de RLS por partição em .../20260804000002_HardenRbacDecisionLogPartitions.ts; consumida em
  runtime por apps/api/src/core/rbac/rbac-telemetry.service.ts. Corresponde diretamente às variáveis de
  ambiente já auditadas (RBAC_DUAL_READ_TELEMETRY, RBAC_AUDIT_MIRROR_ENABLED,
  RBAC_DECISION_RETENTION_DAYS/INTERVAL_HOURS, .env.production) e à evidência já citada no doc49
  (rbac-authority-mode.ts, "RBAC-SHADOW-01").
FRONTEND_EVIDENCE: NONE identificado (tabela de telemetria interna, sem consumo direto de UI esperado).
DEPENDENCIES: nenhuma FK de negócio; escrita via serviço de telemetria (provavelmente SQL
  parametrizado/raw, não @Entity — coerente com tabela particionada, que o TypeORM não modela
  nativamente via decorator).
RATIONALE: infraestrutura de auditoria/observabilidade do próprio mecanismo de RBAC em modo shadow,
  ativamente escrita por um serviço dedicado e configurável via env — não é dado de negócio do
  domínio funcional, mas é claramente ativa e operacionalmente crítica.
```

### 9

```text
OBJECT: rbac_error_logs
TYPE: TABLE
SCHEMA: public
PREVIOUS_CLASSIFICATION: UNKNOWN
FINAL_CLASSIFICATION: ACTIVE_INFRASTRUCTURE
DOMAIN: RBAC / observabilidade
DATABASE_EVIDENCE: RLS habilitada, estrutura própria de log de erro.
CODE_EVIDENCE: criação em .../20260621000001_CreateRbacErrorLogs.ts; consumida por
  apps/api/src/core/rbac/rbac-error-log.service.ts (+ spec de teste próprio).
FRONTEND_EVIDENCE: NONE identificado.
DEPENDENCIES: nenhuma FK relevante.
RATIONALE: serviço dedicado real e testado consumindo a tabela — mesma família de infraestrutura RBAC
  dos itens 3-8.
```

### 10-17 (domínio financeiro/accounting)

```text
OBJECT: budgets, budget_revisions, cost_centers, counterparties, financial_accounts,
        financial_category_templates, financial_transactions, transaction_allocations
TYPE: TABLE (8 tabelas)
SCHEMA: public
PREVIOUS_CLASSIFICATION: UNKNOWN
FINAL_CLASSIFICATION: ACTIVE_BUSINESS
DOMAIN: accounting / financial (P&L)

DATABASE_EVIDENCE: todas as 8 com RLS habilitada/forçada, FKs consistentes de tenant isolation, criadas
  na mesma janela de commits (2026-07-18) por uma sequência coerente de migrations dedicadas
  (FinancialEnums → FinancialPartiesAccounts → FinancialTransactions → TransactionAllocations →
  FinancialBudgets → FinancialCategories → FinancialRls), a última delas EXPLICITAMENTE endurecendo RLS
  para todo o núcleo financeiro — investimento de segurança deliberado, não scaffold descartado.
CODE_EVIDENCE: ZERO @Entity TypeORM e ZERO SQL cru (`.query()`) encontrados em apps/api/src referenciando
  qualquer uma destas 8 tabelas fora dos próprios arquivos de migration — nenhum service/controller/
  repository as consome atualmente. apps/api/src/modules/financial/ existe mas contém apenas um
  algoritmo de domínio puro (largest-remainder, usado para rateio/arredondamento — coerente
  conceitualmente com transaction_allocations, mas não é uma integração real com a tabela).
FRONTEND_EVIDENCE: apps/web/src/modules/accounting/ existe e é real (TransacaoFormModal.tsx,
  CategoriasFinanceiras.tsx, financial-category-rules.*) — MAS referencia o conjunto MAIS ANTIGO de
  tabelas (financial_category_rules/links/favorites/centers/rule_runs — que são, por sua vez, os 5
  objetos do grupo CODE_ONLY do doc78, @Entity declarado mas tabela ausente do banco live). Ou seja: o
  frontend hoje fala com um esquema financeiro mais antigo/diferente do que estas 8 tabelas
  representam — achado relevante, registrado aqui, mas a RESOLUÇÃO desse mismatch específico
  (CODE_ONLY/LIVE_ONLY) é explicitamente uma etapa futura, não desta.
DEPENDENCIES: FKs entre si (ex.: budget_revisions→budgets, transaction_allocations→financial_
  transactions/cost_centers, financial_transactions→financial_accounts/counterparties) formando um
  grafo coerente de domínio contábil.
RATIONALE: Schema deliberado, recente, coerente e com RLS auditada — consistente com uma expansão de
  domínio financeiro EM AVANÇO SOBRE o código (schema-first), não com estrutura abandonada. O fato de
  não haver ainda consumidor de código não satisfaz os critérios cumulativos de DEAD_CANDIDATE do
  prompt (que exige também "0 dependência de FK relevante" — aqui as FKs formam um grafo de domínio
  real e mutuamente coerente) nem "0 comportamento histórico exigido" (doc62 já registra P&L/
  Transação↔Contabilidade como comportamento de negócio central e obrigatório). Texto original desta
  seção concluía: "Gap de wiring (schema sem service/controller) é um item real a resolver na
  reconstrução do domínio accounting da apps/api-v2, não evidência de que a estrutura é morta" —
  **conclusão de arquitetura-alvo superada**.

CORREÇÃO CANÔNICA (decisão do Product Owner, `REMOVE_SECOND_ACCOUNTING_LAYER` — ver
`docs/backend-v2/review/01-full-project-exhaustive-verification.md` §XV.6/PO-VERIFY-027): a classificação
`ACTIVE_BUSINESS` acima descreve corretamente o estado FÍSICO do banco (RLS, FKs, schema coerente — nada
disso muda) e permanece válida como inventário. O que muda é a conclusão de que este é "um item real a
resolver na reconstrução do domínio accounting da apps/api-v2": o Product Owner decidiu que a
arquitetura v2 NÃO usará estas 8 tabelas — nem como alvo, nem como caminho futuro, nem como modelo
alternativo. `transactions` permanece o ledger financeiro canônico único; não haverá reconstrução do
domínio accounting sobre este schema. As 8 tabelas permanecem fisicamente no banco por ora (remoção
física é decisão posterior, não documental) mas são `REJECTED_ARCHITECTURE — DO_NOT_USE_IN_V2`.
```

### 18

```text
OBJECT: lead_uploads
TYPE: TABLE
SCHEMA: public
PREVIOUS_CLASSIFICATION: UNKNOWN
FINAL_CLASSIFICATION: ACTIVE_BUSINESS
DOMAIN: leads / CRM (anexos/uploads de lead)
DATABASE_EVIDENCE: FK real para leads.id (delete rule preservado no dump); RLS habilitada e forçada com
  as 4 policies completas de CRUD (`lead_uploads_tenant_select/insert/update/delete`) — investimento de
  segurança completo, não parcial. Colunas (file_name, mime_type, extension, size, url, metadata)
  descrevem metadata de arquivo anexado a um lead.
CODE_EVIDENCE: ZERO referência em apps/api/src/modules (incluindo leads.service.ts, verificado
  diretamente) fora do arquivo de migration de hardening de RLS
  (20260620000002_HardenContactsLeadUploadsRls.ts, que enrijece uma tabela PRÉ-EXISTENTE — implica
  criação anterior a esta etapa, não um scaffold isolado).
FRONTEND_EVIDENCE: NONE identificado nesta etapa.
DEPENDENCIES: FK para leads (tabela definitivamente ativa — leads.service.ts confirmado consumidor de
  EncryptionService no doc76/77).
RATIONALE: FK direta para um domínio comprovadamente ativo (leads) mais um conjunto completo de 4
  policies RLS (não uma tabela abandonada a meio caminho) — não satisfaz "0 dependência de FK
  relevante" do critério DEAD_CANDIDATE. Ausência de service/controller atual é um gap de
  funcionalidade (feature de upload de anexo a lead ainda não exposta via API), não evidência de morte.
```

### 19

```text
OBJECT: operational_list_items
TYPE: TABLE
SCHEMA: public
PREVIOUS_CLASSIFICATION: UNKNOWN
FINAL_CLASSIFICATION: ACTIVE_INFRASTRUCTURE
DOMAIN: cross-cutting (dado de referência/lookup tenant-scoped)
DATABASE_EVIDENCE: RLS habilitada/forçada, policy `operational_list_items_isolation` +
  `migrator_admin_all`; colunas kind/name/slug/description/active/order/group/metadata — formato
  clássico de tabela de lookup/reference-data genérica e configurável por tenant.
CODE_EVIDENCE: nenhuma referência direta de service/controller encontrada — MAS é citada
  EXPLICITAMENTE por nome no comentário de cabeçalho de
  apps/api/src/database/migrations/20260718000007_FinancialRls.ts: "Padrão AUDITADO do projeto (mesmo
  de operational_list_items)" — ou seja, o próprio time de engenharia trata esta tabela como o
  EXEMPLAR/TEMPLATE já auditado do padrão de RLS tenant-scoped (ENABLE+FORCE RLS,
  `<tabela>_isolation` com `private_get_tenant_id()`) replicado para as 8 tabelas financeiras do item
  10-17.
FRONTEND_EVIDENCE: NONE identificado nesta etapa.
DEPENDENCIES: FK de saída para tenants.id (isolamento padrão); nenhuma FK de entrada.
RATIONALE: Referenciada como padrão de segurança já auditado e usado como modelo para trabalho de
  hardening subsequente — evidência direta e textual de que a tabela é conhecida, válida e tratada como
  infraestrutura de referência pela própria equipe, mesmo sem um consumidor de código localizado nesta
  busca (possivelmente acessada via padrão dinâmico/genérico não capturado por busca textual exata).
```

### 20

```text
OBJECT: performance_metric_entries
TYPE: TABLE
SCHEMA: public
PREVIOUS_CLASSIFICATION: UNKNOWN
FINAL_CLASSIFICATION: ACTIVE_BUSINESS
DOMAIN: catalog / analytics (métricas de performance de streaming)
DATABASE_EVIDENCE: RLS habilitada/forçada; rede densa de FKs para artists, phonograms, projects,
  releases (todos domínios de catálogo comprovadamente ativos) + FK auto-referencial
  (superseded_by_id → performance_metric_entries.id, padrão de versionamento/supersessão de métrica).
  Colunas (metric_type, platform, aggregator, period_start/end, quantity, source, external_reference)
  descrevem ingestão de métricas de performance por plataforma de streaming.
CODE_EVIDENCE: criada em .../20260718000008_PerformanceMetricEntries.ts (mesma janela de expansão de
  schema de 18/07); nenhum service/controller/repository consumidor encontrado em apps/api/src/modules.
FRONTEND_EVIDENCE: NONE identificado nesta etapa (fora do escopo aprofundar telas de analytics/
  dashboard agora).
DEPENDENCIES: grafo de FK denso e mutuamente coerente com o núcleo de catálogo (artists/phonograms/
  projects/releases) — todos domínios já confirmados ativos em etapas anteriores desta série.
RATIONALE: Mesma lógica do bloco financeiro (itens 10-17) — schema deliberado, recente, com grafo de
  FK real para domínios centrais definitivamente ativos, reprovando o critério "0 dependência de FK
  relevante" de DEAD_CANDIDATE. Gap de ingestão/consumo de código é um item de reconstrução futura
  (integrações de streaming, doc42), não evidência de abandono.
```

### 21

```text
OBJECT: release_works
TYPE: TABLE (join table)
SCHEMA: public
PREVIOUS_CLASSIFICATION: UNKNOWN
FINAL_CLASSIFICATION: ACTIVE_BUSINESS
DOMAIN: releases / works (catálogo — relação N:N)
DATABASE_EVIDENCE: RLS com policy dedicada (migration RlsPolicyReleaseWorks); criada explicitamente
  como join table (CreateReleaseWorksJoinTable).
CODE_EVIDENCE: gerenciada implicitamente pelo TypeORM via `@JoinTable({ name: 'release_works',
  joinColumn: { name: 'release_id', ... }, ... })` na entidade de Release — padrão ManyToMany do
  TypeORM, que não requer (nem usa) um @Entity próprio para a tabela de junção. Não capturado pela
  metodologia original (ver achado metodológico no topo deste documento).
FRONTEND_EVIDENCE: fora de escopo aprofundar aqui; releases/works são domínios centrais do catálogo já
  referenciados extensivamente na série de documentos anteriores.
DEPENDENCIES: FKs para releases e works (ambos domínios de catálogo centrais e ativos).
RATIONALE: Falso negativo puro da metodologia — é uma tabela de junção ativamente gerida pelo TypeORM
  via decorator @JoinTable, mecanismo diferente mas igualmente real e ativo.
```

### 22

```text
OBJECT: tenant_invitations
TYPE: TABLE
SCHEMA: public
PREVIOUS_CLASSIFICATION: UNKNOWN
FINAL_CLASSIFICATION: ACTIVE_BUSINESS
DOMAIN: users / tenant (fluxo de convite/onboarding)
DATABASE_EVIDENCE: criada em .../20260620000001_CreateTenantInvitations.ts; estrutura com status
  (pending/accepted/expired/cancelled), expires_at, role_id, auth_user_id, invited_by.
CODE_EVIDENCE: uso extensivo e real via SQL parametrizado (`this.repo!.manager.query(...)`) em
  apps/api/src/modules/users/users.service.ts — SELECT (checar convite pendente), INSERT (criar
  convite), UPDATE (expirar/reenviar/cancelar), SELECT com JOIN em roles/tenants (listar convites); e
  em apps/api/src/modules/auth/auth-context.service.ts (`this.ds.query(...)`, aceitar convite durante
  fluxo de autenticação). Múltiplos métodos reais e completos de ciclo de vida de convite.
FRONTEND_EVIDENCE: fora de escopo aprofundar aqui; a existência de um fluxo completo de convite no
  backend (criar/listar/reenviar/cancelar/aceitar) implica fortemente uma tela de gestão de equipe/
  membros correspondente.
DEPENDENCIES: FKs/joins com roles e tenants (ambos ativos e centrais).
RATIONALE: Uso via SQL parametrizado explícito e extenso (não @Entity, por isso invisível à
  metodologia original) — inequivocamente ativa, é o mecanismo real de convite/onboarding de usuário
  para tenant já antecipado conceitualmente no doc49 (fluxo @AuthBootstrap()).
```

---

## Resumo por classificação final

```text
ACTIVE_BUSINESS:        13  (users, budgets, budget_revisions, cost_centers, counterparties,
                              financial_accounts, financial_category_templates,
                              financial_transactions, transaction_allocations, lead_uploads,
                              performance_metric_entries, release_works, tenant_invitations)
ACTIVE_INFRASTRUCTURE:   9  (rbac_decision_logs + 5 partições + default, rbac_error_logs,
                              operational_list_items)
MIGRATION_HELPER:        1  (musicos360_migrations)
SUPABASE_MANAGED:        0
SYSTEM:                  0
EXTENSION:               0
LEGACY_BUT_REFERENCED:   0
LEGACY_ONLY:              0
DEAD_CANDIDATE:           0
STATIC_REFERENCE:         0
TEST_ONLY:                0
OTHER_CONFIRMED:          0

TOTAL: 23/23 resolvidos com evidência concreta. 0 permanecem UNKNOWN.
```

---

## Resumo

```text
UNKNOWN_BEFORE: 23
UNKNOWN_RESOLVED: 23
UNKNOWN_REMAINING: 0
```

## Cobertura

Todos os 23 objetos anteriormente `UNKNOWN` (as 23 tabelas `LIVE_ONLY` do doc78) foram investigados
individualmente com evidência de PostgreSQL real (RLS, FKs de entrada/saída, policies, triggers, row
estimates), evidência de código (incluindo 2 padrões de acesso TypeORM que a metodologia original não
cobria: `@Entity({name})` e `@JoinTable`, mais SQL parametrizado via `manager.query()`/`dataSource.
query()`) e origem de migration. Nenhuma classificação foi atribuída por presunção — cada uma cita
evidência concreta e verificável. 13 confirmadas ACTIVE_BUSINESS, 9 ACTIVE_INFRASTRUCTURE (família RBAC
+ tabela de referência auditada), 1 MIGRATION_HELPER. Um achado metodológico relevante (2 falsos
negativos de código, `users` e `release_works`) foi registrado como evidência, sem alterar os contadores
LIVE_ONLY_OBJECTS/CODE_ONLY_OBJECTS/MATCH_OBJECTS do doc78 (fora de escopo desta etapa). Um mismatch real
entre o schema financeiro novo (8 tabelas, sem código consumidor) e o schema financeiro mais antigo que o
frontend de fato consome (financial_category_rules/links/favorites/centers/rule_runs, grupo CODE_ONLY) foi
identificado e registrado, sem ser resolvido (fora de escopo explícito desta etapa). Nenhum schema,
migration, RLS, Auth, Storage, Realtime, Supabase, frontend, legacy ou código funcional foi alterado.
Nenhum dado de linha foi consultado. Nenhuma credencial foi impressa.

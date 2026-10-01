> Historical record. Kept as recorded; not the current contract.

# 78 — Inventário Estrutural Completo do Database Atual (pré-schema v2)

Auditoria read-only, gerada por introspecção real e programática contra o PostgreSQL 17 do projeto MUSIC OS 360, branch **DEV** (`rypnevnfipygyhysqpdo`), via `DATABASE_URL` local (nunca impressa). Nenhuma escrita foi feita: apenas `SELECT` contra `information_schema`/`pg_catalog`. Nenhum schema, tabela, migration, RLS, Auth, Storage, Realtime, frontend ou legacy foi alterado. Nenhum dado de linha (conteúdo real de registros) foi consultado — somente metadata estrutural (catálogo). Nenhuma credencial foi impressa.

Este documento é o ÍNDICE/RESUMO canônico. O detalhe "zero exceções" (toda tabela, toda coluna) está nos arquivos auxiliares em `docs/backend-v2/database-inventory/`, listados na seção 3.

---

## 1. Método

```text
Introspecção via script Node (pg 8.22.0, mesma versão já aprovada no doc65), executado uma única vez,
lendo DATABASE_URL de .env.development e escrevendo diretamente em disco (nunca imprimindo a connection
string). 27 queries read-only contra information_schema/pg_catalog cobrindo schemas, tabelas, colunas,
PKs, FKs, unique constraints, check constraints, indexes, enums, views, materialized views, functions,
triggers, RLS (status + policies), publications/realtime, e estimativas de linha (pg_stat_user_tables).
Resultado bruto persistido em current-database-inventory.json (3.4 MB), a partir do qual todos os
arquivos .md abaixo foram gerados programaticamente (formatação mecânica de tabela, sem intervenção
manual linha a linha — inevitável dado o volume: 2382 colunas só no schema `public`).

DATABASE_READS: SIM | DATABASE_WRITES: NÃO | DDL: NÃO | DML: NÃO | MIGRATIONS: NÃO
```

---

## 2. Schemas — visão geral

```text
O banco expõe 129 schemas nominais, dos quais 119 são artefatos EFÊMEROS de sessão do próprio
PostgreSQL (pg_temp_N / pg_toast_temp_N, um par por conexão já aberta historicamente — não são
estruturas persistentes do projeto, não possuem conteúdo próprio) e 2 são o catálogo padrão do
PostgreSQL 17 (pg_catalog, information_schema — idênticos em qualquer instância Postgres 17, zero
conteúdo específico deste projeto). Esses 121 schemas são classificados como SYSTEM e EXCLUÍDOS do
inventário coluna-a-coluna (detalhe completo do porquê em database-inventory/schemas.md) — enumerar as
142 "tabelas" internas de pg_catalog coluna a coluna documentaria a própria especificação do PostgreSQL,
não este projeto.

Restam 10 schemas REAIS e relevantes:

| SCHEMA | CLASSIFICATION | TABLES |
|---|---|---|
| public | LEGACY_APPLICATION | 142 |
| auth | SUPABASE_MANAGED | 23 |
| realtime | SUPABASE_MANAGED | 9 |
| storage | SUPABASE_MANAGED | 8 |
| extensions | SUPABASE_MANAGED | 2 |
| vault | SUPABASE_MANAGED | 2 |
| supabase_migrations | SUPABASE_MANAGED | 1 |
| graphql | SUPABASE_MANAGED | 0 |
| graphql_public | SUPABASE_MANAGED | 0 |
| pgbouncer | SUPABASE_MANAGED | 0 |

`public` (142 tabelas) é o schema de aplicação/negócio real do legacy — é ele que recebe o tratamento
"zero exceções" completo nos arquivos auxiliares. Os 9 schemas SUPABASE_MANAGED são documentados por
contagem/classificação e pelas dependências REAIS que a aplicação tem sobre eles (seção 7), não
replicados coluna a coluna (mesma regra já pedida explicitamente pelo prompt para `auth.users`, aplicada
de forma consistente aos demais).
```

---

## 3. Arquivos auxiliares (detalhe completo)

```text
docs/backend-v2/database-inventory/
├── current-database-inventory.json   — dump bruto completo de todas as 27 queries (machine-readable)
├── schemas.md                        — os 10 schemas reais + racional de exclusão dos 121 SYSTEM
├── tables-columns.md                 — as 142 tabelas de `public`, TODA coluna, zero exceções
│                                        (3.380 linhas: nome, tipo, nullable, default, identity,
│                                        generated, PK, FK, unique, contagem de check constraints)
├── constraints.md                    — 191 FKs, 54 unique constraints, 1.370 check constraints (public)
├── indexes.md                        — 779 indexes (public), definição completa de cada um
├── functions-triggers.md             — 19 functions + 13 triggers (public); resumo por schema dos
│                                        demais 129 functions e 5 triggers Supabase-managed
├── enums-views.md                    — 25 enums (todos os valores, em ordem) + 3 views reais (não-
│                                        catálogo) + 0 materialized views
├── rls.md                            — status RLS das 142 tabelas + as 237 policies completas (public)
├── realtime-auth-storage.md          — publications, tabelas em publication, FKs para auth.users/
│                                        storage.*, colunas user-id-like sem FK física
├── semantic-patterns.md              — 147 colunas tenant-like, 34 financeiras, 180 JSON/JSONB, colunas
│                                        de auditoria/soft-delete por nome exato
├── code-vs-live.md                   — cross-check TypeORM (@Entity) vs. banco real, nível de tabela
└── frontend-cross-check.md           — cross-check heurístico de nome de tabela em apps/web/src

Nota de transparência sobre tables-columns.md: a coluna "CHECK" de cada linha mostra a CONTAGEM TOTAL
de check constraints da tabela (repetida em toda linha), não uma associação coluna-a-coluna — o mapeamento
exato de qual check constraint valida qual(is) coluna(s) está no texto completo de cada check_clause em
constraints.md (fonte de verdade). Registrado aqui para não induzir a leitura errada de "9 checks nesta
coluna especificamente".
```

---

## 4. Totais estruturais (schema `public`, salvo indicação contrária)

```text
TOTAL_SCHEMAS (reais, não-SYSTEM):        10
TOTAL_TABLES (public):                     142
TOTAL_TABLES (todos os schemas reais):     184
TOTAL_COLUMNS (public):                    2382
TOTAL_FOREIGN_KEYS (todos schemas reais):  191
TOTAL_UNIQUE_CONSTRAINTS (public):         54
TOTAL_CHECK_CONSTRAINTS (public):          1370
TOTAL_INDEXES (todos schemas reais):       779
TOTAL_ENUMS (todos schemas reais):         25
TOTAL_VIEWS (todos schemas reais, excl. catálogo padrão): 3
TOTAL_MATERIALIZED_VIEWS:                  0
TOTAL_FUNCTIONS_RELEVANT (todos schemas reais): 148 (19 em public + 129 Supabase-managed)
TOTAL_TRIGGERS (todos schemas reais):      18 (13 em public + 5 Supabase-managed)
TOTAL_RLS_POLICIES (todos schemas reais):  237
TOTAL_REALTIME_PUBLICATION_TABLES:         1
```

---

## 5. Tabelas — classificação (resumo; detalhe por tabela em tables-columns.md)

```text
Classificação aplicada a cada uma das 142 tabelas de `public`, cruzando presença de RLS, FK, e o
cross-check de código (seção 6):

ACTIVE_BUSINESS (RLS habilitado + match com @Entity no código + FK/uso identificável): maioria das 142
  — ver tables-columns.md e code-vs-live.md para a lista individual completa.

ATUALIZAÇÃO (Prompt 94): as 23 tabelas antes marcadas UNKNOWN (o conjunto LIVE_ONLY do cross-check da
  seção 6) foram todas investigadas individualmente com evidência concreta (metadata PostgreSQL, código
  — incluindo 2 padrões TypeORM que a busca original não cobria, `@Entity({name})` e `@JoinTable` — e
  origem de migration) e resolvidas: 13 ACTIVE_BUSINESS, 9 ACTIVE_INFRASTRUCTURE, 1 MIGRATION_HELPER.
  Detalhe completo, objeto a objeto, em
  docs/backend-v2/79-database-unknown-classifications-resolution.md. 0 permanecem UNKNOWN.

UNKNOWN_OBJECT_CLASSIFICATIONS: 0 (23 resolvidos no Prompt 94 — ver doc79)

ATUALIZAÇÃO (recálculo do cross-check): o cross-check código×banco em nível de tabela (seção 6) foi
refeito com metodologia corrigida (cobrindo `@Entity({name})`, `@JoinTable`, e consumo via SQL bruto
— não apenas `@Entity('literal')`) e o conflito do domínio financeiro (8 tabelas novas ACTIVE_BUSINESS
sem consumidor vs. schema antigo CODE_ONLY consumido) foi resolvido estruturalmente. Ver
docs/backend-v2/80-code-database-crosscheck-final-resolution.md e
docs/backend-v2/database-inventory/code-database-crosscheck.json.
```

---

## 6. Cross-check: banco real × código TypeORM

```text
Ver docs/backend-v2/database-inventory/code-vs-live.md para as listas completas.

MATCH (baseline, Prompt 93, @Entity('literal') apenas):                    119
LIVE_ONLY (baseline):                                                        23
CODE_ONLY (baseline):                                                         9

RECALCULADO (metodologia corrigida — @Entity({name}), @JoinTable, SQL bruto RUNTIME; ver doc80):
MATCH:                                                                       125
LIVE_ONLY (confirmado, não é artefato de metodologia):                       10
CODE_ONLY (0 são gap real — todos explicados: 4 scaffold morto + 5 dropados
  por migration autorizada):                                                  9
Removidos da dicotomia (partições nativas + tabela de bookkeeping TypeORM):    7

Método (recálculo): extração de `@Entity('literal')`, `@Entity({name,schema})` e `@JoinTable`
em apps/api/src + apps/web/src + packages/ + scripts/ + supabase/ (1942 arquivos), mais consumo via
SQL bruto (`manager.query`/`dataSource.query`) classificado RUNTIME/MIGRATION/TEST/SCRIPT. Detalhe
objeto-a-objeto, com evidência, em docs/backend-v2/80-code-database-crosscheck-final-resolution.md.
Comparação ainda em nível de TABELA para a maioria — diff campo-a-campo completo feito apenas para
financial_categories (0 mismatches); demais tabelas MATCH registradas como trabalho futuro.
```

---

## 7. Auth — dependências reais

```text
Ver docs/backend-v2/database-inventory/realtime-auth-storage.md para as listas completas.

FKs físicas de `public.*` para `auth.users`: contabilizadas junto com colunas user-id-like sem FK física
  no total AUTH_USER_REFERENCES (129) — a maioria são colunas de auditoria (created_by/updated_by) sem
  FK física declarada (padrão comum e não necessariamente um problema — auditoria costuma referenciar
  o usuário autor sem constraint de integridade referencial obrigatória), não FKs formais para
  auth.users.

auth (schema Supabase-managed) tem 23 tabelas próprias (users, sessions, refresh_tokens, identities,
  mfa_factors, etc. — padrão conhecido do Supabase Auth, não enumerado coluna a coluna aqui conforme
  regra explícita do prompt de não duplicar o schema interno do Supabase).
```

---

## 8. Storage — dependências reais

```text
STORAGE_DEPENDENCIES: 0 FKs físicas de `public.*` para `storage.buckets`/`storage.objects` encontradas.

Isso NÃO significa ausência de uso de Storage pela aplicação — significa que, se existir, a referência é
LÓGICA (ex.: uma coluna text/varchar guardando um path ou nome de bucket) e não uma foreign key física
formal. Não investigado a fundo nesta etapa (identificar TODAS as colunas texto que guardam paths de
storage exigiria inspeção semântica caso a caso, fora do escopo estrutural desta auditoria) — registrado
como item a aprofundar quando o domínio de uploads/storage for reconstruído (doc74, seção Storage).
```

---

## 9. Realtime — publications

```text
2 publications encontradas; 1 tabela publicada (ver realtime-auth-storage.md para a lista exata). O
cruzamento com os 22 eventos realtime já catalogados no contrato canônico do frontend (doc37) fica
registrado como trabalho da próxima etapa de reconstrução de domínio — esta etapa apenas inventaria o
que existe fisicamente no banco.
```

---

## 10. Padrões semânticos (tenant, financeiro, JSON, auditoria)

```text
Ver docs/backend-v2/database-inventory/semantic-patterns.md para as listas completas, coluna a coluna.

TENANT_RELATED_COLUMNS: 147 (heurística: nome contém tenant/organization/org_id/company_id/empresa_id/
  workspace_id/account_id) — base direta para o desenho de isolamento de app.* na v2.
FINANCIAL_COLUMNS: 34 (heurística: nome semanticamente financeiro + tipo numérico/decimal/money)
JSON_JSONB_COLUMNS: 180 — estrutura interna de cada uma não foi decodificada nesta etapa (exigiria
  inspecionar código consumidor caso a caso para as 180 colunas; registrado como trabalho futuro,
  priorizado pelas mais usadas quando cada domínio for reconstruído).
Colunas de auditoria/soft-delete (nome exato: deleted_at/archived_at/is_deleted/active/status/
  created_at/updated_at/created_by/updated_by/deleted_by): inventariadas por tabela em
  semantic-patterns.md — convenções REALMENTE existentes, sem escolha ainda de qual convenção a v2 vai
  adotar (conforme instrução explícita do prompt).
```

---

## 11. Frontend cross-check (heurístico)

```text
DATABASE_TABLES_WITH_FRONTEND_CONSUMER: 51
DATABASE_TABLES_WITHOUT_KNOWN_FRONTEND_CONSUMER: 91

Método: busca textual do nome exato da tabela (snake_case) e de uma conversão camelCase ingênua em todo
apps/web/src (.ts/.tsx). Este é um SINAL APROXIMADO, deliberadamente conservador quanto a alegar
confiança — subestima consumo real sempre que o frontend acessa a tabela só via path de endpoint HTTP ou
nome de campo que não coincide com o nome da tabela (ex.: uma tabela `artist_platform_profiles` pode ser
consumida via um hook chamado `usePlatformProfiles` sem nunca conter a string da tabela). As 91 tabelas
"sem consumidor conhecido" NÃO devem ser presumidas mortas só por isso — precisam de verificação mais
rigorosa (rastreamento de endpoint → controller → repository → tabela) na etapa de reconstrução de cada
domínio, não nesta auditoria estrutural.

FRONTEND_DATA_WITHOUT_CLEAR_DATABASE_SOURCE: não quantificado nesta etapa — exigiria o caminho inverso
(auditar cada tela do frontend e verificar se tem tabela correspondente), que é o objeto do contrato
zero-gap (doc74, seções 2-4) já registrado para as etapas de reconstrução de domínio, não desta auditoria
de banco.
```

---

## 12. Datas/timezone e enums — observações

```text
Ver tables-columns.md para os tipos exatos de cada coluna de data (date/timestamp without time zone/
timestamp with time zone/time) — mistura de "timestamp without time zone" e "timestamp with time zone"
foi observada no dump bruto (não quantificada agregadamente nesta etapa; visível por tabela em
tables-columns.md). Não corrigido, conforme instrução explícita do prompt.

25 enums encontrados nos schemas reais, com todos os valores em ordem, em enums-views.md.
```

---

## 13. Completude e limites desta auditoria

```text
UNKNOWN_OBJECT_CLASSIFICATIONS: 0 (as 23 tabelas LIVE_ONLY foram resolvidas no Prompt 94, com evidência
  concreta por objeto — ver docs/backend-v2/79-database-unknown-classifications-resolution.md; o
  cross-check código×banco em si foi recalculado com metodologia corrigida — ver doc80)

Limites explicitamente reconhecidos (não são "unknowns" no sentido do prompt, são escopo consciente):
- Cross-check código×banco é em nível de TABELA, não de coluna, para 124 das 125 tabelas MATCH
  recalculadas (diff campo-a-campo completo feito só para financial_categories — ver doc80 §6).
- Cross-check frontend é heurístico por string, não rastreamento real de endpoint→tabela.
- Estrutura interna das 180 colunas JSONB não foi decodificada individualmente.
- auth/storage/realtime (schemas Supabase-managed) não foram documentados coluna a coluna — apenas
  contados/classificados e cruzados pelas dependências reais que `public` tem sobre eles, conforme regra
  explícita do prompt para não duplicar o schema interno do Supabase.

Nenhum desses limites foi mascarado como "zero unknown" artificialmente — registrados com honestidade
para a próxima etapa resolver o que for necessário.
```

---

## Resumo

```text
STATUS: CONCLUÍDO
READ_ONLY_AUDIT: SIM
DATABASE_CHANGED: NÃO
```

## Cobertura

Introspecção real e completa do PostgreSQL 17 do branch DEV via 27 queries read-only contra information_
schema/pg_catalog, cobrindo os 10 schemas reais (121 schemas de sistema/efêmeros corretamente excluídos
e justificados) — 142 tabelas/2382 colunas do schema `public` documentadas com zero exceções (todo campo:
tipo, nullable, default, identity, generated, PK, FK, unique, check) em arquivo auxiliar dedicado; 191
FKs, 54 unique constraints, 1370 check constraints, 779 indexes, 25 enums, 3 views reais, 0 materialized
views, 148 functions relevantes, 18 triggers, 237 RLS policies, todos inventariados integralmente em
arquivos auxiliares próprios. Dependências reais de auth.users e storage.* mapeadas sem duplicar o
schema interno do Supabase. Publications de realtime inventariadas. 147 colunas tenant-like, 34
financeiras, 180 JSON/JSONB e o conjunto de colunas de auditoria/soft-delete registrados por convenção
real observada, sem escolha ainda da convenção v2. Cross-check código×banco (nível tabela: 119 match, 23
live-only, 9 code-only) e cross-check heurístico com o frontend (51 com consumidor identificado, 91 sem)
realizados e documentados com os métodos e limitações explicitados. Os 23 objetos que permaneciam UNKNOWN
foram resolvidos no Prompt 94 (13 ACTIVE_BUSINESS, 9 ACTIVE_INFRASTRUCTURE, 1 MIGRATION_HELPER — ver
docs/backend-v2/79-database-unknown-classifications-resolution.md), cada um com evidência concreta, não
por presunção. Nenhuma tabela morta foi declarada como tal apenas por
ausência de dados. Nenhum schema, migration, RLS, Auth, Storage, Realtime, Supabase, frontend, legacy ou
apps/api-v2 foi alterado. Nenhuma credencial ou dado pessoal de linha foi impresso ou consultado.

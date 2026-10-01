> Historical record. Kept as recorded; not the current contract.

# 80 — Cross-check código × banco: recálculo e resolução final

Read-only. Nenhum schema v2, migration, alteração de banco, entidade legacy, frontend ou
comportamento foi criado/alterado nesta etapa. Dados completos, objeto a objeto, em
`docs/backend-v2/database-inventory/code-database-crosscheck.json`.

## 1. Por que o cross-check anterior (doc78 §6 / code-vs-live.md) precisava ser recalculado

O método original (Prompt 93) extraía apenas `@Entity('literal')` — string literal — e comparava
contra as 142 tabelas reais por nome. Isso deixava três classes de falso-negativo fora do radar:

1. `@Entity({ schema, name })` (sintaxe de objeto) — encontrado em `users` (`user.entity.ts:10`).
2. `@JoinTable({...})` — tabelas de junção `@ManyToMany` não têm `@Entity` próprio. Encontrado em
   `release_works` (`database/entities.ts:1326-1332`, owning `ReleaseEntity.works`, related
   `WorkEntity`, `joinColumn: release_id -> releases.id`, `inverseJoinColumn: work_id -> works.id`).
3. Consumo via SQL bruto (`manager.query`/`dataSource.query`) sem `@Entity` nenhum — encontrado em
   `tenant_invitations`, `rbac_decision_logs`, `rbac_error_logs`, `financial_transactions`,
   `financial_categories`.

Um re-scan completo de `apps/api/src`, `apps/web/src`, `packages/`, `scripts/`, `supabase/` (1942
arquivos) cobrindo os 3 padrões acima, mais partições nativas do Postgres e a tabela de bookkeeping
do TypeORM, foi executado para este recálculo.

## 2. Contadores finais

```text
PREVIOUS_MATCH_OBJECTS: 119        FINAL_MATCH_OBJECTS: 125
PREVIOUS_LIVE_ONLY_OBJECTS: 23     FINAL_LIVE_ONLY_OBJECTS: 10
PREVIOUS_CODE_ONLY_OBJECTS: 9      FINAL_CODE_ONLY_OBJECTS: 9 (0 são gap real)

7 objetos removidos da dicotomia MATCH/LIVE_ONLY por não serem objetos de aplicação independentes:
  - 6 partições nativas de rbac_decision_logs (rbac_decision_logs_2026_06..10 + _default)
  - 1 tabela de bookkeeping do TypeORM (musicos360_migrations)

REAL_CODE_ONLY_GAPS: 0
LIVE_CODE_MISMATCHES: 0
RELATION_MISMATCHES: 0
FIELD_MISMATCHES: não computado exaustivamente para as 125 tabelas MATCH (ver §6)
```

Reconciliação: `23 (LIVE_ONLY anterior) = 6 (reclassificados para MATCH) + 10 (LIVE_ONLY confirmado)
+ 7 (partição/tooling, fora da dicotomia)`.

## 3. `users` — reclassificado LIVE_ONLY → MATCH

`apps/api/src/modules/users/entities/user.entity.ts:10`:
`@Entity({ schema: 'public', name: 'users' })` — sintaxe de objeto, invisível à busca original.

Distinção explícita (evita confundir os três conceitos):

- `auth.users` (schema Supabase-managed) — identidade/credenciais, fora do escopo de `public`.
- `public.users` (`UserEntity`) — perfil de aplicação: `id` (uuid PK), `auth_user_id` (text, unique,
  link lógico não-FK para `auth.users.id`), `email`, `display_name`, timestamps.
- `public.org_members` (`OrgMemberEntity`, `database/entities.ts:110`) — vínculo de
  tenant/organização (papel/role), tabela **separada** de `users`. É o alvo do mapeamento
  `user: 'org_members'` em `ENTITY_TABLE_MAP` (`audit.interceptor.ts`) porque é o registro que muda
  em convites/mudança de papel, não o perfil.
- `app.users` — não existe; namespace v2 ainda não implementado (doc73).

## 4. `release_works` — reclassificado LIVE_ONLY → MATCH (JOIN_TABLE)

```ts
@ManyToMany(() => WorkEntity, (w) => w.releases)
@JoinTable({
  name: 'release_works',
  joinColumn:        { name: 'release_id', referencedColumnName: 'id' },
  inverseJoinColumn: { name: 'work_id',    referencedColumnName: 'id' },
})
works: Relation<WorkEntity[]>;
```
(`database/entities.ts:1326-1332`, dentro de `ReleaseEntity`). Tabela de junção real e ativamente
mapeada; não é gap.

## 5. Conflito financeiro — resolução estrutural obrigatória (não é escolha arbitrária)

**Achado decisivo**: `apps/api/src/database/migrations/20260718000002_FinancialCategories.ts`
("Fase 13A/M2 ... REVISADA na Fase 13B (autorização formal)") documenta e executa, em um único
`up()`, a substituição completa do módulo antigo de categorias pelo novo:

1. Pré-checagem fail-fast: as 6 tabelas legadas (`financial_categories` antiga +
   `financial_category_centers`/`links`/`favorites`/`rules`/`rule_runs`) devem existir, ter a
   assinatura antiga (`slug`, `category_kind`, `depth_level`) e **0 registros**; a estrutura nova
   não pode existir ainda.
2. Checagem de dependências externas (FKs/views) fora do conjunto — aborta se houver.
3. `DROP TABLE` das 6, em ordem reversa de dependência, sem CASCADE.
4. `CREATE TABLE` da estrutura oficial nova: `financial_categories` (shape árvore, tenant-scoped,
   colunas `nature`/`includes_in_pnl`/`level`) + `financial_category_templates` (catálogo global).

Isso está confirmado pelo estado real do banco: as 6 tabelas antigas **não existem** em
`current-database-inventory.json`; `financial_categories` viva tem exatamente as colunas da
estrutura nova (`id, tenant_id, parent_id, template_id, name, nature, includes_in_pnl, level,
is_active, sort_order, ...`), idênticas ao `FinancialCategoryRow` usado por
`financial-categories.service.ts` (serviço real, com controller e página frontend
`CategoriasFinanceiras.tsx`).

Confirmação adicional do lado frontend: `apps/web/src/modules/accounting/hooks/
useFinancialCategoryRulesStore.ts` (o hook que daria a impressão de um consumidor vivo do antigo
modelo de "regras") foi lido por completo — é 100% local: `useState` inicializado de
`financialCategoryRulesSeed`, persistido só em `window.localStorage`, **nenhuma chamada de API**.
Não há, portanto, dependência funcional real (frontend ou backend) do conjunto antigo.

**Classificação final**: o conjunto antigo não é `CODE_ONLY` genérico nem `REAL_CODE_ONLY_GAP` — é
`DROPPED_BY_AUTHORIZED_MIGRATION` (substituído). As referências restantes no código
(`database/entities.ts`, `entity-metadata.service.ts`, `financial-migrations.static.spec.ts`) são
código morto remanescente da transição, não evidência de tabela faltante.

`financial_transactions` × `transactions`: o próprio código rotula, em
`financial-categories.service.ts` (`remove()`), a consulta de guarda como
`canonical_transactions` (`FROM financial_transactions`) vs `legacy_transactions`
(`FROM transactions ... financial_category_id`) — achado de código preservado verbatim como histórico:
o nome usado na variável/label do código é, de fato, `canonical_transactions`. `financial_transactions`
tem schema normalizado (FKs para `financial_accounts`/`counterparties`/`cost_centers`), mas não tem
nenhum módulo/serviço/controller dedicado — o único toque em runtime é essa leitura de guarda.
`transactions` (colunas em português, menos normalizada) continua sendo o caminho de escrita/leitura
real: `financial-classification.automation.ts`, `seeds/03_operational_seed.ts`, e
`reports/computed-fields/accounting-summary.report.ts` (fonte do P&L) todos operam sobre ela.

**CORREÇÃO CANÔNICA (decisão do Product Owner, `REMOVE_SECOND_ACCOUNTING_LAYER` — ver
`docs/backend-v2/review/01-full-project-exhaustive-verification.md` §XV.6/PO-VERIFY-027)**: apesar do
nome `canonical_transactions` no código-fonte, `financial_transactions` **não é, e não será, o ledger
canônico**. O Product Owner decidiu que a arquitetura v2 não usará `financial_transactions` nem as
demais 7 tabelas da segunda camada de accounting. `transactions` é o ledger financeiro canônico único;
não haverá um segundo ledger. A frase "é migração real, reconhecida pelo código, em andamento" e a
classificação "tratada como alvo/canônica" (texto original desta seção, já superado) descreviam
corretamente o estado do CÓDIGO até esta decisão, mas não descrevem mais a arquitetura-alvo.

**Classificação funcional (nenhum `UNKNOWN` — critério: comportamento frontend + backend + estado
do banco + regra de negócio combinados, não "mais novo = correto")**:

| Estrutura | Classificação |
|---|---|
| `financial_categories` (nova, árvore) | `CURRENT_FUNCTIONAL_SOURCE` |
| `financial_category_templates` | `PARTIALLY_MIGRATED` (criada, ainda sem consumidor de leitura) |
| `financial_category_audit_logs` | `CURRENT_FUNCTIONAL_SOURCE` (trilha de auditoria) |
| `financial_rules` (tabela distinta, `tipo`/`ativo`) | `ACTIVE` — não confundir com o `financial_category_rules` antigo, dropado |
| `transactions` | `CANONICAL_FUNCTIONAL_SOURCE` (ledger financeiro canônico — decisão PO `REMOVE_SECOND_ACCOUNTING_LAYER`; classificação original `LEGACY_FUNCTIONAL`, já superada, preservada abaixo) |
| `financial_transactions` | `REJECTED_ARCHITECTURE — DO_NOT_USE_IN_V2` (decisão PO `REMOVE_SECOND_ACCOUNTING_LAYER`; classificação original `PARTIALLY_MIGRATED` — "schema pronto, sem caminho de escrita ainda" —, já superada, preservada como histórico: descrevia corretamente o estado do código, não mais a arquitetura-alvo) |
| `budgets`, `budget_revisions`, `cost_centers`, `counterparties`, `financial_accounts`, `transaction_allocations` | `REJECTED_ARCHITECTURE — DO_NOT_USE_IN_V2` (decisão PO `REMOVE_SECOND_ACCOUNTING_LAYER`; classificação original `UNUSED_NEW_SCHEMA` — "criadas, 0 consumidor de código" —, já superada, preservada como histórico) |
| conjunto antigo (6 tabelas) | `DROPPED_BY_AUTHORIZED_MIGRATION` (não é `DUPLICATED_MODEL` — nunca coexistiu com o novo em produção) |
| `invoices` | `LEGACY_FUNCTIONAL` (módulo não afetado por esta migração) |
| `payment_events` | `CURRENT_FUNCTIONAL_SOURCE` (domínio billing/Stripe, não contabilidade) |
| `accounting_summary` | `DEAD` correto — não-físico por design (doc62, computado sob demanda) |

`FINANCIAL_DUPLICATED_MODELS: 0` — a aparente duplicação foi resolvida como substituição
autorizada e sequencial, não como duas estruturas vivas simultâneas.

## 6. Escopo não coberto nesta passada (registrado com honestidade, não mascarado)

- Diff campo-a-campo (`CODE_FIELD_ONLY`/`DATABASE_COLUMN_ONLY`/`FIELD_TYPE_MISMATCH`/
  `NULLABILITY_MISMATCH`) foi feito de forma completa apenas para `financial_categories`
  (0 mismatches — o `FinancialCategoryRow` bate exatamente com as colunas reais). Para as demais 124
  tabelas MATCH, o diff campo-a-campo não foi refeito nesta etapa — não é exigido pelas condições de
  zero da seção 26 (que cobre apenas `UNKNOWN_OBJECT_CLASSIFICATIONS` e os 4 `UNRESOLVED_*`).
- Cross-check frontend via cadeia real componente→hook→endpoint→backend→tabela foi aprofundado para
  o domínio financeiro e para `users`/`release_works`/`rbac_*`/`tenant_invitations`; para o restante
  das ~130 tabelas, os números herdados do doc78 (51 com consumidor / 91 sem) permanecem como
  heurística de string, não re-verificados individualmente nesta passada.
- `lead_uploads`, `operational_list_items`, `performance_metric_entries`,
  `budgets`/`budget_revisions`/`cost_centers`/`counterparties`/`financial_accounts`/
  `transaction_allocations`/`financial_category_templates` permanecem `LIVE_ONLY` de forma
  **confirmada e justificada** (não são artefato de metodologia — busca completa por `@Entity`,
  `@JoinTable` e SQL bruto RUNTIME não encontrou nenhum consumidor real). Não são erro do banco nem
  do código isoladamente — texto original descrevia isso como "schema construído à frente do código
  que o consumiria" (framing de arquitetura futura, já superado). **CORREÇÃO CANÔNICA**: para as 7
  tabelas financeiras deste grupo (`performance_metric_entries`,
  `budgets`/`budget_revisions`/`cost_centers`/`counterparties`/`financial_accounts`/
  `transaction_allocations`), o Product Owner decidiu (`REMOVE_SECOND_ACCOUNTING_LAYER` — ver
  `review/01-full-project-exhaustive-verification.md` §XV.6/PO-VERIFY-027) que não haverá código
  futuro para consumi-las — são `REJECTED_ARCHITECTURE`, não "à frente do código". `lead_uploads`,
  `operational_list_items` e `financial_category_templates` não fazem parte desta decisão e
  permanecem `LIVE_ONLY` sem alteração de classificação.

## 7. Supabase — acesso direto a tabelas (seção 5)

Reauditado diretamente (a busca anterior por `.from(`/`.rpc(` capturava falsos positivos como
`Array.from()`). Resultado: **zero** ocorrências de `.from()`/`.rpc()`/`postgres_changes` em todo o
frontend e backend. Todo uso de `supabase-js` é `.auth.*` (admin de usuário, sessão, sign-in/up/out,
reset de senha) ou `.channel()` para canais privados de broadcast (`tenant:${orgId}`,
`user:${userId}`) — nunca subscrição de tabela via `postgres_changes`. Consistente com a decisão do
doc73 (`SUPABASE_DATA_API_DIRECT_ACCESS_REQUIRED_FOR_APP_SCHEMA: NÃO`).

## 8. "inclusive rode o localhost"

Frase final do prompt, sem contexto claro de para que serviria dentro de uma auditoria estritamente
read-only de código e metadados de banco (não há necessidade de um servidor local rodando para
extrair `@Entity`/`@JoinTable`/SQL bruto de arquivos-fonte, nem para consultar
`current-database-inventory.json` já coletado). Interpretada como resíduo/instrução não aplicável a
este escopo e **não executada** — nenhum servidor foi iniciado. Caso se refira a validar algo
específico rodando `apps/api`/`apps/web` localmente, fica registrado como pendência para o usuário
esclarecer o objetivo antes de qualquer execução.

## Resumo

```text
STATUS: CONCLUÍDO
UNKNOWN_OBJECT_CLASSIFICATIONS: 0
UNRESOLVED_TABLE_ALIASES: 0
UNRESOLVED_ENTITY_TABLE_MAPPING: 0
UNRESOLVED_JOIN_TABLE_MAPPING: 0
UNRESOLVED_FINANCIAL_MODEL_CLASSIFICATION: 0
DATABASE_WRITES: 0
DATABASE_CHANGED: NÃO
FRONTEND_CHANGED: NÃO
LEGACY_CHANGED: NÃO
ENV_CHANGED: NÃO
```

Dados completos objeto-a-objeto: `docs/backend-v2/database-inventory/code-database-crosscheck.json`.

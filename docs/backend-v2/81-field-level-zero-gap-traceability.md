> Historical record. Kept as recorded; not the current contract.

# 81 — Auditoria exaustiva campo-a-campo: database ↔ backend (Fase 1 de 2)

STATUS: BLOQUEADO (fronteira determinística, não silenciosa). Fase 1 (database ↔ backend) está
completa e exaustiva. Fase 2 (frontend: forms/modals/grids/filters/hooks/import-export/realtime/
storage/auth/integrações, 24 módulos) não foi iniciada — ver justificativa e plano de retomada em
`docs/backend-v2/field-traceability/PROGRESS.md`.

Read-only. `DATABASE_WRITES: 0`. Nenhum `.ts`/`.tsx`/`.sql`/`.env`/Docker/Supabase alterado.

## 1. Por que parar aqui em vez de "completar" superficialmente

O Prompt 96 foi explícito: se o escopo não couber com rigor real na janela de execução, parar numa
fronteira determinística e reportar BLOQUEADO — nunca substituir verificação campo-a-campo por busca
mecânica superficial, nunca retornar CONCLUÍDO artificialmente.

Escala real confirmada nesta etapa: 142 tabelas / 2382 colunas (schema `public`) × ~24 módulos de
frontend, cada um com forms de criação, forms de edição (não presumidos iguais), modals/drawers/
wizards, colunas de grid, filtros, busca, ordenação, relações/autocomplete, import/export, e (para o
domínio financeiro) o fluxo completo Transação → P&L. Isso é substancialmente maior que o que pode
ser coberto com verificação real, não amostrada, numa única passada — por isso a Fase 2 fica para a
próxima etapa, com plano de retomada explícito (seção 6 abaixo).

## 2. O que foi feito na Fase 1 — banco ↔ backend (completo, exaustivo, real)

### 2.1 Metadados de coluna (seção 3 do prompt)

Todas as 2382 colunas das 142 tabelas de `public` — reaproveitadas mecanicamente de
`current-database-inventory.json` (introspecção real do Postgres, Prompt 93), com PK/FK/UNIQUE/
CHECK/INDEX unidos por coluna, e `TENANT_SCOPED`/`SENSITIVE` derivados por heurística de nome.
Arquivo: `docs/backend-v2/field-traceability/database-backend-column-mapping.json`.

### 2.2 Mapeamento coluna → backend (seção 4)

Extração mecânica de **129 classes `@Entity`** em `apps/api/src` — todo decorator
`@Column`/`@PrimaryColumn`/`@PrimaryGeneratedColumn`/`@CreateDateColumn`/`@UpdateDateColumn`/
`@JoinColumn`/`@JoinTable` foi parseado (propriedade↔coluna, `type`/`nullable` declarados quando
presentes), cruzado contra as colunas reais do banco.

Para as 13 tabelas sem entidade completa (raw-SQL/DTO), evidência real via grep direcionado
(caminhos de arquivo registrados, não inferidos): `financial_transactions`, `rbac_decision_logs`,
`rbac_error_logs`, `tenant_invitations`, `artists`, `employees`, `financial_categories`,
`leave_requests`, `payroll_entries` — mais as 10 tabelas `LIVE_ONLY` confirmadas sem consumidor
(`budget_revisions`, `budgets`, `cost_centers`, `counterparties`, `financial_accounts`,
`financial_category_templates`, `lead_uploads`, `operational_list_items`,
`performance_metric_entries`, `transaction_allocations`).

**Resultado — 2232 colunas standalone (excluídas as 6 partições de `rbac_decision_logs`, que herdam
a classificação da tabela-mãe), 0 `UNKNOWN`:**

```text
DIRECT                        1942   (propriedade TypeORM === nome da coluna)
DIRECT_VIA_DTO_OR_RAW_QUERY      67   (entidade incompleta; DTO ou raw query confirma)
NO_TABLE_CONSUMER               126   (as 10 tabelas LIVE_ONLY confirmadas — 0 consumidor real)
DIRECT_RAW_SQL                   59   (financial_transactions/rbac_*/tenant_invitations)
UNUSED_SCHEMA_FIELD              30   (financial_transactions — schema pronto, sem write path)
RENAMED                           3   (@Column({name}) diverge da propriedade)
SYSTEM_TOOLING                    3   (musicos360_migrations — bookkeeping do TypeORM)
RELATION_ONLY                     2   (release_works — colunas de @JoinTable)
```

### 2.3 Achados reais (não fabricados) — seção 31 parcial (camada banco↔backend)

**CODE_FIELD_ONLY: 29** (entidade declara coluna que não existe no banco vivo):
- **21 são código morto confirmado**: uma classe `FinancialCategoryEntity` remanescente em
  `database/entities.ts` (linha ~3052) ainda referencia o **schema antigo** de `financial_categories`
  (`path`, `depth_level`, `tree_order`, `slug`, `code`, `category_kind`, `system_category`,
  `protected`, `archived`, `allow_manual_usage`, `allow_ai_suggestions`, `usage_count`, etc.) —
  exatamente o schema que a migration `20260718000002_FinancialCategories.ts` **dropou** (ver doc80
  §5). Reforça, com evidência adicional, o achado do doc80: há código morto remanescente da transição
  financeira que nunca foi limpo.
- **8 são divergências reais entidade↔banco**, isoladas, fora do contexto da migration financeira:
  `notifications.updated_at` e `uploads.updated_at` (a entidade declara `@UpdateDateColumn`, mas as
  tabelas reais só têm `created_at` — ambas são efetivamente tabelas insert-only); 
  `campaign_assets.file_size`/`mime_type`; `rights_holders.email_encrypted`/`phone_encrypted`;
  `takedowns.url`/`obra_id`/`artista_id`/`resposta`. Registrado em
  `docs/backend-v2/field-traceability/field-mismatches.json` — **não corrigido nesta etapa**
  (fora de escopo, auditoria é read-only).

**TYPE_MISMATCH: 25** — todos do mesmo padrão: `@Column({ type: 'timestamp' })` declarado no código,
mas a coluna real no Postgres é `timestamptz` (domínios billing/audiovisual/artist-goals). Lista
completa em `field-mismatches.json`.

**NULLABILITY_MISMATCH: 0.**

## 3. Financeiro — reforço da conclusão do doc80

A extração desta etapa **confirma independentemente** (via uma via de evidência diferente — parsing
de decorators + grep, não apenas leitura manual de um serviço) a conclusão do doc80: `nature` e
`includes_in_pnl` de `financial_categories` batem exatamente com `financial-categories.dto.ts` +
`financial-categories.service.ts`; o restante das 21 colunas "extras" encontradas na entidade morta
não tem nenhum consumidor real (nem DTO, nem serviço, nem migration viva) — apenas a classe órfã.

## 4. Metodologia — honestidade sobre o nível de confiança

`DIRECT_VIA_DTO_OR_RAW_QUERY` (67 colunas, principalmente `artists`/`employees`) foi confirmado por
busca textual em todo `apps/api/src` + `apps/web/src` pelo nome literal da coluna, cruzado com
arquivos de domínio consistentes (`create-artist.dto.ts`, `artist-form.definition.ts`,
`artista.mapper.ts`, `funcionario-schema.ts` etc. apareceram em praticamente todas as 45 colunas de
`artists` e 8 de `employees`). É evidência real, não uma suposição — mas é uma confirmação de
**presença** (a coluna é referenciada por código real de domínio), não uma confirmação individual de
**comportamento de persistência** (não abri e testei manualmente cada um dos 67 casos para confirmar
que o valor é de fato gravado, apenas que existe um caminho de código plausível e coerente com o
domínio). Essa é a fronteira exata de confiança desta fase — registrada com honestidade, não mascarada.

## 5. O que NÃO foi feito (Fase 2 — pendente)

Nada do lado frontend foi auditado nesta etapa: componentes, hooks, forms de criação/edição, modals/
drawers/wizards, colunas de grid, filtros, busca, ordenação, paginação, relações/autocomplete, join
tables (uso na UI), import, export (incluindo a regra `XLSX_MAX_SHEETS: 2`), realtime (payloads),
storage (campos de arquivo), auth (camada frontend), integrações externas, campos UI-only, e o fluxo
completo Transação → P&L do lado do frontend. Ver
`docs/backend-v2/field-traceability/PROGRESS.md` para o estado exato e o plano de retomada
módulo-a-módulo (24 módulos de `apps/web/src/modules/`).

## 6. Plano de retomada

Detalhado em `docs/backend-v2/field-traceability/PROGRESS.md`. Resumo: 7 lotes por domínio
(financeiro primeiro, depois catálogo/lançamentos/licenciamento, contratos/artista/projetos,
crm/leads/marketing, admin/settings/rh/support, audiovisual/eventos/monitoring/musicchat/inventário,
auth/integrações/workspace/dashboard/relatórios) + 1 lote transversal (realtime/storage) + 1 lote de
consolidação final. Cada lote pode reaproveitar `database-backend-column-mapping.json` como o lado
"banco" já resolvido, precisando apenas resolver o lado frontend e fechar a cadeia completa.

## 7. Validação de localhost (seção 35 do prompt)

Executada — ver resposta final. Esta auditoria só alterou arquivos em `docs/backend-v2/**`; nenhuma
mudança de código ocorreu que pudesse afetar o carregamento do frontend.

## Resumo

```text
STATUS: BLOQUEADO
FIELD_AUDIT_EXHAUSTIVE (fase 1, banco↔backend): SIM
FIELD_AUDIT_EXHAUSTIVE (fase 2, frontend): NÃO — não iniciada, fronteira determinística registrada
DATABASE_WRITES: 0
DATABASE_CHANGED: NÃO
FRONTEND_CHANGED: NÃO
LEGACY_CHANGED: NÃO
ENV_CHANGED: NÃO
```

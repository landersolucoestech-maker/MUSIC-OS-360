> Historical record. Kept as recorded; not the current contract.

# 40 — Resolução das 2 Dependências de Domínio Não Resolvidas

Continuação read-only de [`39-domain-dependency-map.md`](./39-domain-dependency-map.md) (`UNRESOLVED_DEPENDENCIES: 2` — `reports` e `dashboard`). Nenhum arquivo foi alterado. O mapa de dependências (doc39) não foi alterado. Nenhuma outra das 82 dependências já classificadas foi reanalisada. `apps/api` não foi consultado — o frontend já foi suficiente para os dois casos.

---

## Caso 1

```text
CASO:
1

DOMAIN:
reports

POTENTIAL_DEPENDENCY:
domínios de negócio não identificados individualmente (artists, contracts, catalog etc.)

MOTIVO_DA_INDEFINIÇÃO:
GET /reports/entities e GET /reports/definitions nunca tiveram o corpo da resposta detalhado em nenhum doc anterior — não havia evidência de QUAIS entidades compõem o catálogo reportável
```

### Investigação

```text
EVIDÊNCIA_FRONTEND:
apps/web/src/modules/reports/services/reports-api.ts:21-58 — tipos completos da resposta real:
- ReportEntity { entityName, tableName, label, category, reportable, columns: ReportColumnMeta[], hasTenantId, hasSoftDelete, hasTimestamps, risks }
- EntitiesInventory { totalEntities, reportableEntities, nonReportableEntities, unknownEntities, entities: ReportEntity[] }
- ReportEntityDefinition { entityName, tableName, category, identityColumn, displayColumn, dateColumn, exportableColumns, importableColumns, filterableColumns, sortableColumns, searchableColumns, sensitiveColumns, requiredImportColumns, supportsExport, supportsImport }

Nenhum nome de entidade específico (ex.: "artists", "contracts") aparece hard-coded em nenhum lugar deste arquivo ou de qualquer consumidor de reports-api.ts — o catálogo é obtido inteiramente em runtime via GET /reports/entities, com metadados de introspecção de schema (hasTenantId, hasSoftDelete, hasTimestamps, columns com tipo/nullable/enum) — características de um sistema que descobre tabelas dinamicamente a partir do próprio schema do backend, não de uma lista fixa conhecida pelo frontend.

EVIDÊNCIA_LEGACY:
NÃO NECESSÁRIA — o frontend já é suficiente para responder à pergunta (não "quais entidades existem hoje", mas "o domínio reports tem uma dependência fixa e nomeável de outros domínios, do ponto de vista do contrato do frontend?").
```

```text
DEPENDENCY_EXISTS:
SIM

DEPENDENCY_TYPE:
OTHER

REQUIRED:
SIM

OPTIONAL:
NÃO

EVIDENCE:
apps/web/src/modules/reports/services/reports-api.ts:21-58 (tipos ReportEntity/EntitiesInventory/ReportEntityDefinition — shape de introspecção de schema, sem nome de domínio fixo)

STATUS:
RESOLVED
```

**Resolução:** o domínio `reports` **depende estruturalmente** de que outros domínios de negócio existam (sem nenhuma entidade reportável, o domínio não tem função) — mas o próprio contrato do frontend prova que essa dependência é **deliberadamente genérica/dinâmica por design**: `reports` foi construído como um sistema de introspecção de schema (metadados como `hasTenantId`/`hasSoftDelete`/`columns` só existem para descrever QUALQUER tabela, não uma lista fixa). Não há, portanto, uma lista fixa de domínios-alvo para registrar — essa é a resposta correta e comprovada pela evidência, não uma lacuna. Diferente do doc39 (onde a pergunta ficou em aberto por falta de evidência), agora há evidência suficiente para concluir que "nenhuma lista fixa" É a resposta certa, não um placeholder para "não sei".
```

---

## Caso 2

```text
CASO:
2

DOMAIN:
dashboard

POTENTIAL_DEPENDENCY:
múltiplos domínios agregados, não identificados individualmente

MOTIVO_DA_INDEFINIÇÃO:
GET /analytics/dashboard nunca teve seu shape de resposta real confirmado — a única pista disponível no doc32 (computeFromMockStorage) é código morto, não prova do contrato real
```

### Investigação

```text
EVIDÊNCIA_FRONTEND:
apps/web/src/modules/dashboard/hooks/useOperationalDashboard.ts:12-45 — interface OperationalDashboard, que É o tipo genérico usado por `useQuery<OperationalDashboard>({ queryFn: () => api.get<OperationalDashboard>("/analytics/dashboard") })` (linha 225, o hook real e exportado, `CONTRACT_COMPLETE` desde o doc34) — portanto este é o contrato real da resposta, não o da função morta. Campos e domínio de origem evidenciado:
- artists, artists_by_status → domínio artists
- contracts, contracts_by_status, active_contracts_count, contracts_expiring_soon_count → domínio contracts
- leads → domínio leads
- open_tickets → domínio support
- campaigns, pending_tasks_count, overdue_tasks_count → domínio marketing (campanhas/tarefas)
- revenue_current_month, expenses_current_month, net_result_current_month, pending_receivables, overdue_invoices_count, paid_transactions_count, cancelled_transactions_count, invoices_by_status, transactions_by_status, transactions_by_tipo → domínio accounting
- onboarding_in_progress_count → domínio auth (onboarding)
- pending_distribution_setups, distributor_submissions_count, society_submissions_count, pending_external_syncs, failed_external_syncs, successful_external_syncs, external_validation_errors_count, pending_provider_requirements_count → domínio releases (distribuição — mesmo campo semântico de "distributor_submissions"/"pending_provider_requirements" já visto no framework de external-data auditado no doc23, ligado ao domínio releases via distribuição digital)
- overdue_followups_count → entidade "followups" (TABLE_ENDPOINT: followups → /followups) — não mapeada a nenhum domínio nomeado no doc38 (achado à parte: nem "leads" nem "clients" citam "followups" explicitamente nas suas evidências; fica registrado como entidade sem domínio doc38 claramente correspondente, não forçado a um encaixe)
- generated_at → metadado do próprio endpoint, não uma dependência de domínio

EVIDÊNCIA_LEGACY:
NÃO NECESSÁRIA — o tipo TypeScript já usado pelo hook real e ativo é evidência suficiente e direta do contrato esperado pelo frontend.
```

```text
DEPENDENCY_EXISTS:
SIM

DEPENDENCY_TYPE:
DATA

REQUIRED:
SIM

OPTIONAL:
NÃO

EVIDENCE:
apps/web/src/modules/dashboard/hooks/useOperationalDashboard.ts:12-45 (interface OperationalDashboard, tipo real do useQuery ativo)

STATUS:
RESOLVED
```

**Resolução:** `dashboard` depende de dado de **artists, contracts, leads, support, marketing, accounting, auth e releases** (8 domínios nomeados, cada um evidenciado por campo(s) específico(s) do tipo `OperationalDashboard` já usado pelo hook real). Um campo (`overdue_followups_count`) referencia uma entidade (`followups`) sem domínio doc38 claramente correspondente — registrado como achado, não forçado a nenhum dos domínios existentes sem evidência direta.

---

## Resumo

```text
UNRESOLVED_DEPENDENCIES_INITIAL:
2

DEPENDENCIES_CONFIRMED_REQUIRED:
2

DEPENDENCIES_CONFIRMED_OPTIONAL:
0

DEPENDENCIES_CONFIRMED_NOT_EXISTING:
0

DEPENDENCIES_CONFLICTING:
0

DEPENDENCIES_REQUIRING_DECISION:
0

UNRESOLVED_DEPENDENCIES_REMAINING:
0
```

Os 2 casos foram resolvidos com evidência direta de tipos TypeScript já usados pelos hooks reais e ativos (não pelas funções mortas citadas no doc32) — nenhuma decisão humana foi necessária, nenhum conflito frontend×legacy apareceu (legacy não foi consultado, desnecessário). O Caso 1 (`reports`) resolveu para uma dependência estrutural genérica-por-design (sem lista fixa de domínios, comprovado pelo shape de introspecção de schema); o Caso 2 (`dashboard`) resolveu para uma dependência concreta e nomeável em 8 domínios, com evidência de campo individual para cada um.

## Cobertura

2/2 dependências `UNRESOLVED` do doc39 resolvidas. Nenhuma das outras 82 dependências já classificadas foi reanalisada. `apps/api` não foi consultado. `apps/web` e `apps/api` não foram alterados. O doc39 não foi modificado.

> Historical record. Kept as recorded; not the current contract.

# Cross-check: Banco Real (live) vs. Código TypeORM (apps/api)

Método: extração de todos os `@Entity('nome_tabela')` declarados em apps/api/src (128 nomes distintos), comparados contra as 142 tabelas base reais do schema `public`.

MATCH: 119
LIVE_ONLY (existe no banco, sem @Entity correspondente encontrado): 23
CODE_ONLY (@Entity declarado, tabela não encontrada no banco live): 9

## LIVE_ONLY (23)

- budget_revisions
- budgets
- cost_centers
- counterparties
- financial_accounts
- financial_category_templates
- financial_transactions
- lead_uploads
- musicos360_migrations
- operational_list_items
- performance_metric_entries
- rbac_decision_logs
- rbac_decision_logs_2026_06
- rbac_decision_logs_2026_07
- rbac_decision_logs_2026_08
- rbac_decision_logs_2026_09
- rbac_decision_logs_2026_10
- rbac_decision_logs_default
- rbac_error_logs
- release_works
- tenant_invitations
- transaction_allocations
- users

## CODE_ONLY (9)

- ai
- auth
- billing
- financial_category_centers
- financial_category_favorites
- financial_category_links
- financial_category_rule_runs
- financial_category_rules
- health

Nota: esta comparação é no nível de TABELA (nome), não de coluna — comparação coluna-a-coluna para as 142 tabelas está fora do escopo desta etapa por volume; fica registrada como trabalho futuro se necessário.

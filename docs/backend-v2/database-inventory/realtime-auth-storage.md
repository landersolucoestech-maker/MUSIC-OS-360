> Historical record. Kept as recorded; not the current contract.

# Realtime, Auth e Storage — Dependências

## Publications

| PUBLICATION | ALL_TABLES |
|---|---|
| supabase_realtime | false |
| supabase_realtime_messages_publication | false |

## Tabelas em publications (1)

| PUBLICATION | SCHEMA | TABLE |
|---|---|---|
| supabase_realtime_messages_publication | realtime | messages |

## Referências a auth.users (0 FKs físicas)

| SOURCE_TABLE | SOURCE_COLUMN | ON_DELETE |
|---|---|---|

## Colunas com nome padrão de identidade de usuário SEM FK física (LOGICAL_RELATION_WITHOUT_FK candidatas, 129)

| TABLE | COLUMN | DATA_TYPE |
|---|---|---|
| activity_logs | user_id | character varying |
| ai_jobs | user_id | character varying |
| ai_usage_logs | user_id | character varying |
| artist_goals | created_by | character varying |
| artists | created_by | character varying |
| artists | updated_by | character varying |
| asset_versions | created_by | character varying |
| assets | created_by | character varying |
| audiovisual_briefings | created_by | character varying |
| audiovisual_briefings | updated_by | character varying |
| audiovisual_projects | created_by | character varying |
| audiovisual_projects | updated_by | character varying |
| audiovisual_tasks | created_by | character varying |
| audiovisual_tasks | updated_by | character varying |
| audiovisual_team_members | user_id | uuid |
| audit_logs | user_id | character varying |
| briefings | created_by | character varying |
| budget_revisions | created_by | uuid |
| budgets | created_by | uuid |
| budgets | updated_by | uuid |
| campaign_assets | created_by | character varying |
| campaign_tasks | created_by | character varying |
| campaigns | created_by | character varying |
| campaigns | updated_by | character varying |
| clients | created_by | character varying |
| clients | updated_by | character varying |
| contract_templates | created_by | character varying |
| contracts | created_by | character varying |
| contracts | updated_by | character varying |
| conversations | created_by | text |
| cost_centers | created_by | uuid |
| cost_centers | updated_by | uuid |
| counterparties | created_by | uuid |
| counterparties | updated_by | uuid |
| departments | created_by | uuid |
| departments | updated_by | uuid |
| ecad_reports | created_by | character varying |
| employees | created_by | character varying |
| events | created_by | character varying |
| events | updated_by | character varying |
| external_identifiers | created_by | character varying |
| financial_accounts | created_by | uuid |
| financial_accounts | updated_by | uuid |
| financial_categories | created_by | uuid |
| financial_categories | updated_by | uuid |
| financial_rules | created_by | character varying |
| financial_rules | updated_by | character varying |
| financial_transactions | created_by | uuid |
| financial_transactions | updated_by | uuid |
| forms | created_by | text |
| inventory_items | created_by | character varying |
| inventory_items | updated_by | character varying |
| invoices | created_by | character varying |
| job_functions | created_by | uuid |
| job_functions | updated_by | uuid |
| lead_interactions | created_by | character varying |
| leads | created_by | character varying |
| leads | updated_by | character varying |
| leave_requests | created_by | character varying |
| licenses | created_by | character varying |
| licenses | updated_by | character varying |
| marketing_asset_versions | created_by | character varying |
| marketing_assets | created_by | character varying |
| marketing_assets | updated_by | character varying |
| marketing_content_posts | created_by | character varying |
| marketing_content_posts | updated_by | character varying |
| marketing_projects | created_by | character varying |
| marketing_projects | updated_by | character varying |
| marketing_strategies | created_by | character varying |
| marketing_strategies | updated_by | character varying |
| marketing_strategy_actions | created_by | character varying |
| marketing_strategy_actions | updated_by | character varying |
| marketing_strategy_initiatives | created_by | character varying |
| marketing_strategy_initiatives | updated_by | character varying |
| marketing_strategy_objectives | created_by | character varying |
| marketing_strategy_objectives | updated_by | character varying |
| marketing_tasks | created_by | character varying |
| marketing_tasks | updated_by | character varying |
| membership_job_functions | created_by | uuid |
| musicchat_automation_settings | updated_by | character varying |
| notifications | user_id | character varying |
| oauth_connections | user_id | character varying |
| operational_list_items | created_by | character varying |
| operational_list_items | updated_by | character varying |
| operational_tasks | created_by | character varying |
| org_members | auth_user_id | character varying |
| org_members | created_by | uuid |
| org_members | updated_by | uuid |
| performance_metric_entries | created_by | uuid |
| performance_metric_entries | updated_by | uuid |
| phonograms | created_by | character varying |
| phonograms | updated_by | character varying |
| pipeline_opportunities | created_by | character varying |
| pipeline_opportunities | updated_by | character varying |
| pipelines | created_by | character varying |
| positions | created_by | uuid |
| positions | updated_by | uuid |
| projects | created_by | character varying |
| projects | updated_by | character varying |
| rbac_decision_logs | user_id | character varying |
| rbac_decision_logs_2026_06 | user_id | character varying |
| rbac_decision_logs_2026_07 | user_id | character varying |
| rbac_decision_logs_2026_08 | user_id | character varying |
| rbac_decision_logs_2026_09 | user_id | character varying |
| rbac_decision_logs_2026_10 | user_id | character varying |
| rbac_decision_logs_default | user_id | character varying |
| rbac_error_logs | user_id | uuid |
| releases | created_by | character varying |
| releases | updated_by | character varying |
| rights_holders | created_by | character varying |
| rights_holders | updated_by | character varying |
| role_permissions | created_by | uuid |
| skill_runs | user_id | character varying |
| society_accounts | created_by | character varying |
| society_accounts | updated_by | character varying |
| society_payload_snapshots | created_by | character varying |
| society_submission_events | created_by | character varying |
| society_sync_jobs | created_by | character varying |
| support_tickets | created_by | character varying |
| takedowns | created_by | character varying |
| tenant_invitations | auth_user_id | character varying |
| transaction_allocations | created_by | uuid |
| transaction_allocations | updated_by | uuid |
| transactions | created_by | character varying |
| transactions | updated_by | character varying |
| uploads | user_id | character varying |
| users | auth_user_id | text |
| works | created_by | character varying |
| works | updated_by | character varying |

## Referências a storage.* (0 FKs físicas)

| SOURCE_TABLE | SOURCE_COLUMN | TARGET_TABLE | TARGET_COLUMN |
|---|---|---|---|

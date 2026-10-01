> Historical record. Kept as recorded; not the current contract.

# Padrões Semânticos — Tenant, Financeiro, JSON/JSONB, Soft-Delete/Auditoria

## Colunas relacionadas a tenant/organização (147)

| TABLE | COLUMN | DATA_TYPE |
|---|---|---|
| activity_logs | tenant_id | uuid |
| ai_jobs | tenant_id | uuid |
| ai_usage_logs | tenant_id | uuid |
| artist_goals | tenant_id | uuid |
| artist_platform_profiles | tenant_id | uuid |
| artists | tenant_id | uuid |
| asset_usage_logs | tenant_id | uuid |
| asset_versions | tenant_id | uuid |
| assets | tenant_id | uuid |
| audiovisual_approvals | tenant_id | uuid |
| audiovisual_assets | tenant_id | uuid |
| audiovisual_briefings | tenant_id | uuid |
| audiovisual_deliverables | tenant_id | uuid |
| audiovisual_production_days | tenant_id | uuid |
| audiovisual_projects | tenant_id | uuid |
| audiovisual_shots | tenant_id | uuid |
| audiovisual_tasks | tenant_id | uuid |
| audiovisual_team_members | tenant_id | uuid |
| audit_logs | tenant_id | uuid |
| audit_logs | org_id | uuid |
| billing_subscriptions | org_id | uuid |
| billing_subscriptions | tenant_id | uuid |
| briefings | tenant_id | uuid |
| budget_revisions | tenant_id | uuid |
| budgets | tenant_id | uuid |
| campaign_assets | tenant_id | uuid |
| campaign_tasks | tenant_id | uuid |
| campaigns | tenant_id | uuid |
| client_attachments | tenant_id | uuid |
| clients | tenant_id | uuid |
| content_detections | tenant_id | uuid |
| contract_service_types | tenant_id | uuid |
| contract_templates | tenant_id | uuid |
| contracts | tenant_id | uuid |
| conversation_messages | tenant_id | uuid |
| conversation_notes | tenant_id | uuid |
| conversations | tenant_id | uuid |
| cost_centers | tenant_id | uuid |
| counterparties | tenant_id | uuid |
| departments | tenant_id | uuid |
| domain_event_log | tenant_id | uuid |
| ecad_reports | tenant_id | uuid |
| employees | tenant_id | uuid |
| events | tenant_id | uuid |
| external_identifiers | tenant_id | uuid |
| financial_accounts | tenant_id | uuid |
| financial_categories | tenant_id | uuid |
| financial_category_audit_logs | tenant_id | uuid |
| financial_rules | tenant_id | uuid |
| financial_transactions | tenant_id | uuid |
| financial_transactions | account_id | uuid |
| financial_transactions | counter_account_id | uuid |
| form_submissions | tenant_id | uuid |
| forms | tenant_id | uuid |
| integrations | tenant_id | uuid |
| inventory_items | tenant_id | uuid |
| invoices | tenant_id | uuid |
| job_functions | tenant_id | uuid |
| lead_interactions | tenant_id | uuid |
| lead_uploads | tenant_id | uuid |
| leads | tenant_id | uuid |
| leave_requests | tenant_id | uuid |
| licenses | tenant_id | uuid |
| marketing_asset_approvals | tenant_id | uuid |
| marketing_asset_versions | tenant_id | uuid |
| marketing_assets | tenant_id | uuid |
| marketing_assets | company_id | uuid |
| marketing_content_posts | tenant_id | uuid |
| marketing_projects | tenant_id | uuid |
| marketing_projects | company_id | uuid |
| marketing_strategies | tenant_id | uuid |
| marketing_strategy_actions | tenant_id | uuid |
| marketing_strategy_initiatives | tenant_id | uuid |
| marketing_strategy_objectives | tenant_id | uuid |
| marketing_tasks | tenant_id | uuid |
| membership_job_functions | tenant_id | uuid |
| musicchat_automation_events | tenant_id | uuid |
| musicchat_automation_notifications | tenant_id | uuid |
| musicchat_automation_settings | tenant_id | uuid |
| notification_settings | tenant_id | uuid |
| notifications | tenant_id | uuid |
| oauth_connections | tenant_id | uuid |
| operational_list_items | tenant_id | uuid |
| operational_tasks | tenant_id | uuid |
| operational_tasks | company_id | uuid |
| org_members | tenant_id | uuid |
| org_members | org_id | uuid |
| organizations | external_auth_org_id | character varying |
| organizations | is_system_tenant | boolean |
| payment_events | tenant_id | uuid |
| payroll_entries | tenant_id | uuid |
| performance_metric_entries | tenant_id | uuid |
| phonograms | tenant_id | uuid |
| pipeline_opportunities | tenant_id | uuid |
| pipeline_opportunities | company_id | uuid |
| pipeline_stages | tenant_id | uuid |
| pipelines | tenant_id | uuid |
| positions | tenant_id | uuid |
| project_assets | tenant_id | uuid |
| project_track_participants | tenant_id | uuid |
| project_tracks | tenant_id | uuid |
| projects | tenant_id | uuid |
| rbac_decision_logs | tenant_id | uuid |
| rbac_decision_logs | workspace_id | uuid |
| rbac_decision_logs_2026_06 | tenant_id | uuid |
| rbac_decision_logs_2026_06 | workspace_id | uuid |
| rbac_decision_logs_2026_07 | tenant_id | uuid |
| rbac_decision_logs_2026_07 | workspace_id | uuid |
| rbac_decision_logs_2026_08 | tenant_id | uuid |
| rbac_decision_logs_2026_08 | workspace_id | uuid |
| rbac_decision_logs_2026_09 | tenant_id | uuid |
| rbac_decision_logs_2026_09 | workspace_id | uuid |
| rbac_decision_logs_2026_10 | tenant_id | uuid |
| rbac_decision_logs_2026_10 | workspace_id | uuid |
| rbac_decision_logs_default | tenant_id | uuid |
| rbac_decision_logs_default | workspace_id | uuid |
| rbac_error_logs | tenant_id | uuid |
| releases | tenant_id | uuid |
| rights_holders | tenant_id | uuid |
| role_inheritance | tenant_id | uuid |
| roles | tenant_id | uuid |
| shares | tenant_id | uuid |
| skill_runs | tenant_id | uuid |
| society_accounts | tenant_id | uuid |
| society_payload_snapshots | tenant_id | uuid |
| society_submission_events | tenant_id | uuid |
| society_submissions | tenant_id | uuid |
| society_submissions | account_id | uuid |
| society_sync_jobs | tenant_id | uuid |
| society_validation_errors | tenant_id | uuid |
| support_tickets | tenant_id | uuid |
| takedowns | tenant_id | uuid |
| task_assets | tenant_id | uuid |
| tenant_billing_state | tenant_id | uuid |
| tenant_invitations | tenant_id | uuid |
| tenant_invitations | org_id | uuid |
| tenants | org_id | uuid |
| tenants | external_auth_org_id | character varying |
| tenants | is_system_tenant | boolean |
| transaction_allocations | tenant_id | uuid |
| transactions | tenant_id | uuid |
| uploads | tenant_id | uuid |
| webhook_events | tenant_id | uuid |
| work_participants | tenant_id | uuid |
| workflow_executions | tenant_id | uuid |
| workflow_transitions | tenant_id | uuid |
| works | tenant_id | uuid |

## Colunas monetárias/financeiras (34)

| TABLE | COLUMN | DATA_TYPE | PRECISION | SCALE |
|---|---|---|---|---|
| ai_jobs | cost_usd | numeric | 12 | 8 |
| ai_usage_logs | cost_usd | numeric | 12 | 6 |
| artist_goals | meta_valor | numeric | 15 | 2 |
| artist_goals | valor_atual | numeric | 15 | 2 |
| audiovisual_team_members | payment_amount | numeric | 15 | 2 |
| billing_plans | amount | integer | 32 | 0 |
| budget_revisions | previous_amount | numeric | 15 | 2 |
| budget_revisions | new_amount | numeric | 15 | 2 |
| budgets | amount | numeric | 15 | 2 |
| contracts | valor | numeric |  |  |
| ecad_reports | valor_bruto | numeric | 15 | 2 |
| ecad_reports | valor_liquido | numeric | 15 | 2 |
| events | valor_cache | numeric | 15 | 2 |
| financial_accounts | opening_balance | numeric | 15 | 2 |
| financial_rules | valor | numeric | 10 | 4 |
| financial_transactions | amount | numeric | 15 | 2 |
| inventory_items | valor_unitario | numeric |  |  |
| invoices | valor | numeric | 15 | 2 |
| invoices | amount_due | integer | 32 | 0 |
| invoices | amount_paid | integer | 32 | 0 |
| invoices | valor_servicos | numeric | 15 | 2 |
| invoices | valor_deducoes | numeric | 15 | 2 |
| invoices | valor_iss | numeric | 15 | 2 |
| invoices | valor_pis | numeric | 15 | 2 |
| invoices | valor_cofins | numeric | 15 | 2 |
| invoices | valor_inss | numeric | 15 | 2 |
| invoices | valor_ir | numeric | 15 | 2 |
| invoices | valor_csll | numeric | 15 | 2 |
| invoices | valor_liquido | numeric | 15 | 2 |
| leads | valor_estimado | numeric |  |  |
| licenses | valor | numeric |  |  |
| pipeline_opportunities | value | numeric | 15 | 2 |
| transaction_allocations | allocated_amount | numeric | 15 | 2 |
| transactions | valor | numeric | 15 | 2 |

## Colunas JSON/JSONB (180)

| TABLE | COLUMN | DATA_TYPE |
|---|---|---|
| activity_logs | metadata | jsonb |
| ai_jobs | metadata | jsonb |
| artist_goals | metadata | jsonb |
| artist_platform_profiles | raw_payload | jsonb |
| artists | especialidades | jsonb |
| artists | contatos_vinculados | jsonb |
| artists | distribuidoras_gerais | jsonb |
| artists | tags_musicais | jsonb |
| artists | relacionamentos | jsonb |
| artists | distribuidoras_selecionadas | jsonb |
| artists | distribuidoras_emails | jsonb |
| artists | distribuidoras_empresa_selecionadas | jsonb |
| artists | distribuidoras_empresa_emails | jsonb |
| artists | contatos_equipe | jsonb |
| artists | galeria_urls | jsonb |
| artists | documentos | jsonb |
| artists | metadata | jsonb |
| asset_usage_logs | metadata | jsonb |
| assets | metadata | jsonb |
| audiovisual_approvals | metadata | jsonb |
| audiovisual_assets | tags | jsonb |
| audiovisual_assets | metadata | jsonb |
| audiovisual_briefings | references_list | jsonb |
| audiovisual_briefings | platforms | jsonb |
| audiovisual_briefings | aspect_ratios | jsonb |
| audiovisual_briefings | color_palette | jsonb |
| audiovisual_briefings | moodboard_links | jsonb |
| audiovisual_briefings | metadata | jsonb |
| audiovisual_deliverables | metadata | jsonb |
| audiovisual_production_days | metadata | jsonb |
| audiovisual_projects | metadata | jsonb |
| audiovisual_shots | actors | jsonb |
| audiovisual_shots | props | jsonb |
| audiovisual_shots | wardrobe | jsonb |
| audiovisual_shots | equipment | jsonb |
| audiovisual_shots | metadata | jsonb |
| audiovisual_tasks | metadata | jsonb |
| audiovisual_team_members | metadata | jsonb |
| audit_logs | before | jsonb |
| audit_logs | after | jsonb |
| audit_logs | metadata | jsonb |
| audit_logs | diff | jsonb |
| billing_plans | features | jsonb |
| billing_plans | limits | jsonb |
| billing_settings | value | jsonb |
| billing_subscriptions | metadata | jsonb |
| briefings | metadata | jsonb |
| campaign_assets | metadata | jsonb |
| campaigns | metadata | jsonb |
| clients | attachments | jsonb |
| clients | interacoes | jsonb |
| clients | metadata | jsonb |
| content_detections | metadata | jsonb |
| contract_service_types | client_types | jsonb |
| contract_service_types | participants | jsonb |
| contract_service_types | variables | jsonb |
| contract_service_types | music_work | jsonb |
| contract_service_types | signature_settings | jsonb |
| contract_service_types | branding_settings | jsonb |
| contract_templates | variaveis | jsonb |
| contracts | versoes | jsonb |
| contracts | signers | jsonb |
| contracts | metadata | jsonb |
| conversation_messages | attachments | jsonb |
| conversation_messages | metadata | jsonb |
| conversations | metadata | jsonb |
| domain_event_log | payload | jsonb |
| ecad_reports | metadata | jsonb |
| employees | documentos | jsonb |
| employees | metadata | jsonb |
| events | participantes | jsonb |
| events | metadata | jsonb |
| external_identifiers | metadata | jsonb |
| financial_category_audit_logs | before | jsonb |
| financial_category_audit_logs | after | jsonb |
| financial_category_audit_logs | metadata | jsonb |
| financial_rules | condicoes | jsonb |
| financial_transactions | category_snapshot | jsonb |
| financial_transactions | metadata | jsonb |
| form_submissions | data | jsonb |
| form_submissions | metadata | jsonb |
| forms | fields | jsonb |
| forms | settings | jsonb |
| integrations | settings | jsonb |
| integrations | metadata | jsonb |
| invoices | metadata | jsonb |
| invoices | itens | jsonb |
| lead_uploads | metadata | jsonb |
| leads | payload_servico | jsonb |
| leads | dados_internos_crm | jsonb |
| leads | uploads | jsonb |
| leads | metadata | jsonb |
| leave_requests | metadata | jsonb |
| marketing_asset_approvals | metadata | jsonb |
| marketing_asset_versions | metadata | jsonb |
| marketing_assets | tags | jsonb |
| marketing_assets | metadata | jsonb |
| marketing_content_posts | files | jsonb |
| marketing_content_posts | metadata | jsonb |
| marketing_projects | goals | jsonb |
| marketing_projects | metrics | jsonb |
| marketing_projects | context | jsonb |
| marketing_projects | metadata | jsonb |
| marketing_strategies | dependencies | jsonb |
| marketing_strategies | metrics | jsonb |
| marketing_strategies | metadata | jsonb |
| marketing_strategy_actions | dependencies | jsonb |
| marketing_strategy_actions | metrics | jsonb |
| marketing_strategy_actions | metadata | jsonb |
| marketing_strategy_initiatives | dependencies | jsonb |
| marketing_strategy_initiatives | metrics | jsonb |
| marketing_strategy_initiatives | metadata | jsonb |
| marketing_strategy_objectives | dependencies | jsonb |
| marketing_strategy_objectives | metrics | jsonb |
| marketing_strategy_objectives | metadata | jsonb |
| marketing_tasks | dependencies | jsonb |
| marketing_tasks | metrics | jsonb |
| marketing_tasks | metadata | jsonb |
| musicchat_automation_events | payload | jsonb |
| musicchat_automation_notifications | metadata | jsonb |
| musicchat_automation_settings | menu_options | jsonb |
| musicchat_automation_settings | templates | jsonb |
| musicchat_automation_settings | required_fields | jsonb |
| musicchat_automation_settings | optional_fields | jsonb |
| musicchat_automation_settings | return_to_menu_rule | jsonb |
| musicchat_automation_settings | escalation_rules | jsonb |
| musicchat_automation_settings | notification_channels | jsonb |
| notification_settings | config_json | jsonb |
| notifications | metadata | jsonb |
| oauth_connections | metadata | jsonb |
| operational_list_items | metadata | jsonb |
| organizations | address | jsonb |
| organizations | config | jsonb |
| organizations | metadata | jsonb |
| payment_events | payload | jsonb |
| payroll_entries | metadata | jsonb |
| phonograms | participacao | jsonb |
| phonograms | arquivo_audio | jsonb |
| phonograms | metadata | jsonb |
| pipeline_opportunities | stage_history | jsonb |
| pipeline_opportunities | metadata | jsonb |
| projects | metadata | jsonb |
| rbac_error_logs | metadata | jsonb |
| releases | plataformas | jsonb |
| releases | assets | jsonb |
| releases | cronograma | jsonb |
| releases | metadata | jsonb |
| rights_holders | metadata | jsonb |
| shares | historico | jsonb |
| shares | metadata | jsonb |
| skill_run_logs | payload | jsonb |
| skill_runs | input_payload | jsonb |
| skill_runs | output_payload | jsonb |
| society_accounts | metadata | jsonb |
| society_payload_snapshots | payload | jsonb |
| society_submission_events | metadata | jsonb |
| society_submissions | metadata | jsonb |
| society_sync_jobs | metadata | jsonb |
| support_tickets | tags | jsonb |
| support_tickets | metadata | jsonb |
| takedowns | metadata | jsonb |
| tenants | features | jsonb |
| tenants | settings | jsonb |
| transactions | metadata | jsonb |
| transactions | financial_category_snapshot | jsonb |
| uploads | metadata | jsonb |
| webhook_events | payload | jsonb |
| workflow_execution_logs | payload | jsonb |
| workflow_transitions | metadata | jsonb |
| works | ia_harmonia | jsonb |
| works | ia_melodia | jsonb |
| works | ia_letra | jsonb |
| works | outros_titulos | jsonb |
| works | referencias_conexas | jsonb |
| works | compositores | jsonb |
| works | letristas | jsonb |
| works | alternative_titles | jsonb |
| works | ai_tools | jsonb |
| works | ai_prompts | jsonb |
| works | metadata | jsonb |

## Colunas de soft-delete/status/auditoria (nome exato, 473)

| TABLE | COLUMN | DATA_TYPE |
|---|---|---|
| activity_logs | created_at | timestamp without time zone |
| ai_jobs | status | character varying |
| ai_jobs | created_at | timestamp without time zone |
| ai_usage_logs | created_at | timestamp with time zone |
| artist_goals | status | character varying |
| artist_goals | created_at | timestamp without time zone |
| artist_goals | updated_at | timestamp without time zone |
| artist_goals | deleted_at | timestamp without time zone |
| artist_goals | created_by | character varying |
| artist_platform_profiles | created_at | timestamp with time zone |
| artist_platform_profiles | updated_at | timestamp with time zone |
| artists | status | character varying |
| artists | created_at | timestamp without time zone |
| artists | updated_at | timestamp without time zone |
| artists | created_by | character varying |
| artists | updated_by | character varying |
| artists | deleted_at | timestamp without time zone |
| asset_usage_logs | created_at | timestamp without time zone |
| asset_versions | created_by | character varying |
| asset_versions | created_at | timestamp without time zone |
| assets | status | character varying |
| assets | created_by | character varying |
| assets | created_at | timestamp without time zone |
| assets | updated_at | timestamp without time zone |
| assets | deleted_at | timestamp without time zone |
| audiovisual_approvals | status | character varying |
| audiovisual_approvals | created_at | timestamp with time zone |
| audiovisual_approvals | updated_at | timestamp with time zone |
| audiovisual_approvals | deleted_at | timestamp with time zone |
| audiovisual_assets | created_at | timestamp with time zone |
| audiovisual_assets | updated_at | timestamp with time zone |
| audiovisual_assets | deleted_at | timestamp with time zone |
| audiovisual_briefings | created_by | character varying |
| audiovisual_briefings | updated_by | character varying |
| audiovisual_briefings | created_at | timestamp with time zone |
| audiovisual_briefings | updated_at | timestamp with time zone |
| audiovisual_deliverables | status | character varying |
| audiovisual_deliverables | created_at | timestamp with time zone |
| audiovisual_deliverables | updated_at | timestamp with time zone |
| audiovisual_deliverables | deleted_at | timestamp with time zone |
| audiovisual_production_days | status | character varying |
| audiovisual_production_days | created_at | timestamp with time zone |
| audiovisual_production_days | updated_at | timestamp with time zone |
| audiovisual_projects | status | character varying |
| audiovisual_projects | created_at | timestamp with time zone |
| audiovisual_projects | updated_at | timestamp with time zone |
| audiovisual_projects | created_by | character varying |
| audiovisual_projects | updated_by | character varying |
| audiovisual_projects | deleted_at | timestamp with time zone |
| audiovisual_shots | created_at | timestamp with time zone |
| audiovisual_shots | updated_at | timestamp with time zone |
| audiovisual_shots | deleted_at | timestamp with time zone |
| audiovisual_tasks | status | character varying |
| audiovisual_tasks | created_by | character varying |
| audiovisual_tasks | updated_by | character varying |
| audiovisual_tasks | created_at | timestamp with time zone |
| audiovisual_tasks | updated_at | timestamp with time zone |
| audiovisual_tasks | deleted_at | timestamp with time zone |
| audiovisual_team_members | created_at | timestamp with time zone |
| audiovisual_team_members | updated_at | timestamp with time zone |
| audiovisual_team_members | deleted_at | timestamp with time zone |
| audit_logs | created_at | timestamp without time zone |
| billing_plans | active | boolean |
| billing_plans | created_at | timestamp with time zone |
| billing_plans | updated_at | timestamp with time zone |
| billing_settings | created_at | timestamp with time zone |
| billing_settings | updated_at | timestamp with time zone |
| billing_subscriptions | status | character varying |
| billing_subscriptions | created_at | timestamp without time zone |
| billing_subscriptions | updated_at | timestamp without time zone |
| briefings | status | character varying |
| briefings | created_at | timestamp without time zone |
| briefings | updated_at | timestamp without time zone |
| briefings | deleted_at | timestamp without time zone |
| briefings | created_by | character varying |
| budget_revisions | created_by | uuid |
| budget_revisions | created_at | timestamp with time zone |
| budgets | created_at | timestamp with time zone |
| budgets | updated_at | timestamp with time zone |
| budgets | created_by | uuid |
| budgets | updated_by | uuid |
| budgets | deleted_at | timestamp with time zone |
| campaign_assets | created_at | timestamp with time zone |
| campaign_assets | created_by | character varying |
| campaign_assets | deleted_at | timestamp with time zone |
| campaign_tasks | status | character varying |
| campaign_tasks | created_at | timestamp with time zone |
| campaign_tasks | updated_at | timestamp with time zone |
| campaign_tasks | created_by | character varying |
| campaigns | status | character varying |
| campaigns | created_at | timestamp without time zone |
| campaigns | updated_at | timestamp without time zone |
| campaigns | created_by | character varying |
| campaigns | updated_by | character varying |
| campaigns | deleted_at | timestamp without time zone |
| client_attachments | created_at | timestamp without time zone |
| client_attachments | deleted_at | timestamp without time zone |
| clients | status | character varying |
| clients | created_at | timestamp without time zone |
| clients | updated_at | timestamp without time zone |
| clients | created_by | character varying |
| clients | updated_by | character varying |
| clients | deleted_at | timestamp without time zone |
| content_detections | status | character varying |
| content_detections | created_at | timestamp without time zone |
| content_detections | updated_at | timestamp without time zone |
| content_detections | deleted_at | timestamp without time zone |
| contract_service_types | active | boolean |
| contract_service_types | deleted_at | timestamp with time zone |
| contract_service_types | created_at | timestamp with time zone |
| contract_service_types | updated_at | timestamp with time zone |
| contract_templates | created_at | timestamp without time zone |
| contract_templates | updated_at | timestamp without time zone |
| contract_templates | deleted_at | timestamp without time zone |
| contract_templates | created_by | character varying |
| contracts | status | character varying |
| contracts | created_at | timestamp without time zone |
| contracts | updated_at | timestamp without time zone |
| contracts | created_by | character varying |
| contracts | updated_by | character varying |
| contracts | deleted_at | timestamp without time zone |
| conversation_messages | created_at | timestamp with time zone |
| conversation_notes | created_at | timestamp with time zone |
| conversation_notes | updated_at | timestamp with time zone |
| conversations | status | USER-DEFINED |
| conversations | created_by | text |
| conversations | created_at | timestamp with time zone |
| conversations | updated_at | timestamp with time zone |
| conversations | deleted_at | timestamp with time zone |
| cost_centers | created_at | timestamp with time zone |
| cost_centers | updated_at | timestamp with time zone |
| cost_centers | created_by | uuid |
| cost_centers | updated_by | uuid |
| cost_centers | deleted_at | timestamp with time zone |
| counterparties | created_at | timestamp with time zone |
| counterparties | updated_at | timestamp with time zone |
| counterparties | created_by | uuid |
| counterparties | updated_by | uuid |
| counterparties | deleted_at | timestamp with time zone |
| departments | created_at | timestamp with time zone |
| departments | updated_at | timestamp with time zone |
| departments | created_by | uuid |
| departments | updated_by | uuid |
| departments | deleted_at | timestamp with time zone |
| domain_event_log | created_at | timestamp without time zone |
| ecad_reports | status | character varying |
| ecad_reports | created_at | timestamp without time zone |
| ecad_reports | updated_at | timestamp without time zone |
| ecad_reports | deleted_at | timestamp without time zone |
| ecad_reports | created_by | character varying |
| employees | status | character varying |
| employees | created_at | timestamp without time zone |
| employees | updated_at | timestamp without time zone |
| employees | created_by | character varying |
| employees | deleted_at | timestamp without time zone |
| events | status | character varying |
| events | created_at | timestamp without time zone |
| events | updated_at | timestamp without time zone |
| events | created_by | character varying |
| events | updated_by | character varying |
| events | deleted_at | timestamp without time zone |
| external_identifiers | created_at | timestamp without time zone |
| external_identifiers | updated_at | timestamp without time zone |
| external_identifiers | created_by | character varying |
| financial_accounts | created_at | timestamp with time zone |
| financial_accounts | updated_at | timestamp with time zone |
| financial_accounts | created_by | uuid |
| financial_accounts | updated_by | uuid |
| financial_accounts | deleted_at | timestamp with time zone |
| financial_categories | created_at | timestamp with time zone |
| financial_categories | updated_at | timestamp with time zone |
| financial_categories | created_by | uuid |
| financial_categories | updated_by | uuid |
| financial_rules | created_by | character varying |
| financial_rules | updated_by | character varying |
| financial_rules | created_at | timestamp with time zone |
| financial_rules | updated_at | timestamp with time zone |
| financial_rules | deleted_at | timestamp with time zone |
| financial_transactions | status | USER-DEFINED |
| financial_transactions | created_at | timestamp with time zone |
| financial_transactions | updated_at | timestamp with time zone |
| financial_transactions | created_by | uuid |
| financial_transactions | updated_by | uuid |
| financial_transactions | deleted_at | timestamp with time zone |
| form_submissions | created_at | timestamp with time zone |
| forms | status | USER-DEFINED |
| forms | created_by | text |
| forms | created_at | timestamp with time zone |
| forms | updated_at | timestamp with time zone |
| forms | deleted_at | timestamp with time zone |
| integrations | status | character varying |
| integrations | created_at | timestamp without time zone |
| integrations | updated_at | timestamp without time zone |
| integrations | deleted_at | timestamp without time zone |
| inventory_items | status | character varying |
| inventory_items | created_at | timestamp with time zone |
| inventory_items | updated_at | timestamp with time zone |
| inventory_items | created_by | character varying |
| inventory_items | updated_by | character varying |
| inventory_items | deleted_at | timestamp with time zone |
| invoices | status | character varying |
| invoices | created_at | timestamp without time zone |
| invoices | updated_at | timestamp without time zone |
| invoices | deleted_at | timestamp without time zone |
| invoices | created_by | character varying |
| job_functions | created_at | timestamp with time zone |
| job_functions | updated_at | timestamp with time zone |
| job_functions | created_by | uuid |
| job_functions | updated_by | uuid |
| job_functions | deleted_at | timestamp with time zone |
| lead_interactions | created_by | character varying |
| lead_interactions | created_at | timestamp without time zone |
| lead_uploads | created_at | timestamp with time zone |
| lead_uploads | deleted_at | timestamp with time zone |
| leads | status | character varying |
| leads | created_at | timestamp without time zone |
| leads | updated_at | timestamp without time zone |
| leads | created_by | character varying |
| leads | updated_by | character varying |
| leads | deleted_at | timestamp without time zone |
| leave_requests | status | character varying |
| leave_requests | created_at | timestamp without time zone |
| leave_requests | updated_at | timestamp without time zone |
| leave_requests | created_by | character varying |
| leave_requests | deleted_at | timestamp without time zone |
| licenses | status | character varying |
| licenses | created_at | timestamp with time zone |
| licenses | updated_at | timestamp with time zone |
| licenses | created_by | character varying |
| licenses | updated_by | character varying |
| licenses | deleted_at | timestamp with time zone |
| marketing_asset_approvals | status | character varying |
| marketing_asset_versions | status | character varying |
| marketing_asset_versions | created_by | character varying |
| marketing_asset_versions | created_at | timestamp with time zone |
| marketing_assets | status | character varying |
| marketing_assets | created_by | character varying |
| marketing_assets | updated_by | character varying |
| marketing_assets | created_at | timestamp with time zone |
| marketing_assets | updated_at | timestamp with time zone |
| marketing_assets | deleted_at | timestamp with time zone |
| marketing_content_posts | status | character varying |
| marketing_content_posts | created_by | character varying |
| marketing_content_posts | updated_by | character varying |
| marketing_content_posts | created_at | timestamp with time zone |
| marketing_content_posts | updated_at | timestamp with time zone |
| marketing_content_posts | deleted_at | timestamp with time zone |
| marketing_projects | status | character varying |
| marketing_projects | created_at | timestamp with time zone |
| marketing_projects | updated_at | timestamp with time zone |
| marketing_projects | created_by | character varying |
| marketing_projects | updated_by | character varying |
| marketing_projects | deleted_at | timestamp with time zone |
| marketing_strategies | status | character varying |
| marketing_strategies | created_by | character varying |
| marketing_strategies | updated_by | character varying |
| marketing_strategies | created_at | timestamp with time zone |
| marketing_strategies | updated_at | timestamp with time zone |
| marketing_strategies | deleted_at | timestamp with time zone |
| marketing_strategy_actions | status | character varying |
| marketing_strategy_actions | created_by | character varying |
| marketing_strategy_actions | updated_by | character varying |
| marketing_strategy_actions | created_at | timestamp with time zone |
| marketing_strategy_actions | updated_at | timestamp with time zone |
| marketing_strategy_actions | deleted_at | timestamp with time zone |
| marketing_strategy_initiatives | status | character varying |
| marketing_strategy_initiatives | created_by | character varying |
| marketing_strategy_initiatives | updated_by | character varying |
| marketing_strategy_initiatives | created_at | timestamp with time zone |
| marketing_strategy_initiatives | updated_at | timestamp with time zone |
| marketing_strategy_initiatives | deleted_at | timestamp with time zone |
| marketing_strategy_objectives | status | character varying |
| marketing_strategy_objectives | created_by | character varying |
| marketing_strategy_objectives | updated_by | character varying |
| marketing_strategy_objectives | created_at | timestamp with time zone |
| marketing_strategy_objectives | updated_at | timestamp with time zone |
| marketing_strategy_objectives | deleted_at | timestamp with time zone |
| marketing_tasks | status | character varying |
| marketing_tasks | created_at | timestamp with time zone |
| marketing_tasks | updated_at | timestamp with time zone |
| marketing_tasks | created_by | character varying |
| marketing_tasks | updated_by | character varying |
| marketing_tasks | deleted_at | timestamp with time zone |
| membership_job_functions | created_at | timestamp with time zone |
| membership_job_functions | created_by | uuid |
| musicchat_automation_events | created_at | timestamp with time zone |
| musicchat_automation_notifications | status | character varying |
| musicchat_automation_notifications | created_at | timestamp with time zone |
| musicchat_automation_settings | created_at | timestamp with time zone |
| musicchat_automation_settings | updated_at | timestamp with time zone |
| musicchat_automation_settings | updated_by | character varying |
| notification_settings | created_at | timestamp with time zone |
| notification_settings | updated_at | timestamp with time zone |
| notifications | created_at | timestamp without time zone |
| oauth_connections | created_at | timestamp without time zone |
| oauth_connections | updated_at | timestamp without time zone |
| operational_list_items | active | boolean |
| operational_list_items | created_by | character varying |
| operational_list_items | updated_by | character varying |
| operational_list_items | created_at | timestamp with time zone |
| operational_list_items | updated_at | timestamp with time zone |
| operational_list_items | deleted_at | timestamp with time zone |
| operational_tasks | status | character varying |
| operational_tasks | created_by | character varying |
| operational_tasks | created_at | timestamp with time zone |
| operational_tasks | updated_at | timestamp with time zone |
| org_members | created_at | timestamp without time zone |
| org_members | updated_at | timestamp without time zone |
| org_members | created_by | uuid |
| org_members | updated_by | uuid |
| org_members | deleted_at | timestamp with time zone |
| organizations | created_at | timestamp without time zone |
| organizations | updated_at | timestamp without time zone |
| organizations | deleted_at | timestamp without time zone |
| payment_events | created_at | timestamp with time zone |
| payroll_entries | status | character varying |
| payroll_entries | created_at | timestamp without time zone |
| payroll_entries | updated_at | timestamp without time zone |
| payroll_entries | deleted_at | timestamp without time zone |
| performance_metric_entries | created_at | timestamp with time zone |
| performance_metric_entries | updated_at | timestamp with time zone |
| performance_metric_entries | created_by | uuid |
| performance_metric_entries | updated_by | uuid |
| permission_aliases | created_at | timestamp with time zone |
| permission_conflicts | created_at | timestamp with time zone |
| permission_dependencies | created_at | timestamp with time zone |
| permission_groups | created_at | timestamp with time zone |
| permissions | created_at | timestamp with time zone |
| permissions | updated_at | timestamp with time zone |
| phonograms | status | character varying |
| phonograms | created_at | timestamp without time zone |
| phonograms | updated_at | timestamp without time zone |
| phonograms | created_by | character varying |
| phonograms | updated_by | character varying |
| phonograms | deleted_at | timestamp without time zone |
| pipeline_opportunities | status | character varying |
| pipeline_opportunities | created_by | character varying |
| pipeline_opportunities | updated_by | character varying |
| pipeline_opportunities | created_at | timestamp with time zone |
| pipeline_opportunities | updated_at | timestamp with time zone |
| pipeline_opportunities | deleted_at | timestamp with time zone |
| pipeline_stages | created_at | timestamp with time zone |
| pipeline_stages | updated_at | timestamp with time zone |
| pipelines | created_by | character varying |
| pipelines | created_at | timestamp with time zone |
| pipelines | updated_at | timestamp with time zone |
| pipelines | deleted_at | timestamp with time zone |
| positions | created_at | timestamp with time zone |
| positions | updated_at | timestamp with time zone |
| positions | created_by | uuid |
| positions | updated_by | uuid |
| positions | deleted_at | timestamp with time zone |
| project_assets | created_at | timestamp without time zone |
| project_track_participants | created_at | timestamp without time zone |
| project_tracks | created_at | timestamp without time zone |
| project_tracks | updated_at | timestamp without time zone |
| projects | status | character varying |
| projects | created_at | timestamp without time zone |
| projects | updated_at | timestamp without time zone |
| projects | created_by | character varying |
| projects | updated_by | character varying |
| projects | deleted_at | timestamp without time zone |
| rbac_decision_logs | created_at | timestamp with time zone |
| rbac_decision_logs_2026_06 | created_at | timestamp with time zone |
| rbac_decision_logs_2026_07 | created_at | timestamp with time zone |
| rbac_decision_logs_2026_08 | created_at | timestamp with time zone |
| rbac_decision_logs_2026_09 | created_at | timestamp with time zone |
| rbac_decision_logs_2026_10 | created_at | timestamp with time zone |
| rbac_decision_logs_default | created_at | timestamp with time zone |
| rbac_error_logs | created_at | timestamp with time zone |
| releases | status | character varying |
| releases | created_at | timestamp without time zone |
| releases | updated_at | timestamp without time zone |
| releases | created_by | character varying |
| releases | updated_by | character varying |
| releases | deleted_at | timestamp without time zone |
| rights_holders | created_at | timestamp without time zone |
| rights_holders | updated_at | timestamp without time zone |
| rights_holders | created_by | character varying |
| rights_holders | updated_by | character varying |
| rights_holders | deleted_at | timestamp without time zone |
| role_inheritance | created_by | uuid |
| role_inheritance | updated_by | uuid |
| role_inheritance | created_at | timestamp with time zone |
| role_inheritance | updated_at | timestamp with time zone |
| role_inheritance | deleted_at | timestamp with time zone |
| role_permissions | created_at | timestamp with time zone |
| role_permissions | created_by | uuid |
| role_template_permissions | created_at | timestamp with time zone |
| role_templates | created_at | timestamp with time zone |
| role_templates | updated_at | timestamp with time zone |
| role_templates | deleted_at | timestamp with time zone |
| roles | created_at | timestamp with time zone |
| roles | updated_at | timestamp with time zone |
| roles | created_by | uuid |
| roles | updated_by | uuid |
| roles | deleted_at | timestamp with time zone |
| roles | archived_at | timestamp with time zone |
| shares | status | character varying |
| shares | created_at | timestamp without time zone |
| shares | updated_at | timestamp without time zone |
| shares | deleted_at | timestamp without time zone |
| skill_run_logs | created_at | timestamp without time zone |
| skill_runs | status | character varying |
| skill_runs | created_at | timestamp without time zone |
| society_accounts | status | character varying |
| society_accounts | created_at | timestamp without time zone |
| society_accounts | updated_at | timestamp without time zone |
| society_accounts | deleted_at | timestamp without time zone |
| society_accounts | created_by | character varying |
| society_accounts | updated_by | character varying |
| society_payload_snapshots | created_by | character varying |
| society_payload_snapshots | created_at | timestamp without time zone |
| society_submission_events | created_by | character varying |
| society_submission_events | created_at | timestamp without time zone |
| society_submissions | status | character varying |
| society_submissions | created_at | timestamp without time zone |
| society_submissions | updated_at | timestamp without time zone |
| society_sync_jobs | status | character varying |
| society_sync_jobs | created_by | character varying |
| society_sync_jobs | created_at | timestamp without time zone |
| society_validation_errors | created_at | timestamp without time zone |
| support_tickets | status | character varying |
| support_tickets | created_by | character varying |
| support_tickets | created_at | timestamp without time zone |
| support_tickets | updated_at | timestamp without time zone |
| support_tickets | deleted_at | timestamp without time zone |
| takedowns | status | character varying |
| takedowns | created_at | timestamp without time zone |
| takedowns | updated_at | timestamp without time zone |
| takedowns | created_by | character varying |
| takedowns | deleted_at | timestamp without time zone |
| task_assets | created_at | timestamp without time zone |
| tenant_billing_state | status | character varying |
| tenant_billing_state | created_at | timestamp with time zone |
| tenant_billing_state | updated_at | timestamp with time zone |
| tenant_invitations | status | character varying |
| tenant_invitations | created_at | timestamp with time zone |
| tenant_invitations | updated_at | timestamp with time zone |
| tenants | active | boolean |
| tenants | created_at | timestamp without time zone |
| tenants | updated_at | timestamp without time zone |
| tenants | deleted_at | timestamp without time zone |
| transaction_allocations | created_at | timestamp with time zone |
| transaction_allocations | updated_at | timestamp with time zone |
| transaction_allocations | created_by | uuid |
| transaction_allocations | updated_by | uuid |
| transactions | status | character varying |
| transactions | created_at | timestamp without time zone |
| transactions | updated_at | timestamp without time zone |
| transactions | deleted_at | timestamp without time zone |
| transactions | created_by | character varying |
| transactions | updated_by | character varying |
| uploads | status | character varying |
| uploads | created_at | timestamp without time zone |
| uploads | deleted_at | timestamp without time zone |
| users | created_at | timestamp with time zone |
| users | updated_at | timestamp with time zone |
| webhook_events | status | character varying |
| webhook_events | created_at | timestamp without time zone |
| work_participants | created_at | timestamp without time zone |
| work_participants | updated_at | timestamp without time zone |
| workflow_execution_logs | status | character varying |
| workflow_execution_logs | created_at | timestamp without time zone |
| workflow_executions | status | character varying |
| workflow_executions | created_at | timestamp without time zone |
| workflow_transitions | created_at | timestamp without time zone |
| works | status | character varying |
| works | created_at | timestamp without time zone |
| works | updated_at | timestamp without time zone |
| works | created_by | character varying |
| works | updated_by | character varying |
| works | deleted_at | timestamp without time zone |

> Historical record. Kept as recorded; not the current contract.

# RLS — Schema `public`

## Status (141 tabelas)

Tabelas com RLS habilitado: 141 de 142
Tabelas com RLS forçado (FORCE ROW LEVEL SECURITY): 130

Tabelas SEM RLS habilitado (1): rbac_decision_logs

## Policies (237)

| TABLE | POLICY | COMMAND | ROLES | USING | WITH_CHECK |
|---|---|---|---|---|---|
| activity_logs | super_admin_full_access | ALL | {authenticated} | app_is_super_admin() | app_is_super_admin() |
| activity_logs | tenant_isolation | ALL | {authenticated} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| ai_jobs | super_admin_full_access | ALL | {authenticated} | app_is_super_admin() | app_is_super_admin() |
| ai_jobs | tenant_isolation | ALL | {authenticated} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| ai_usage_logs | ai_usage_logs_tenant_delete | DELETE | {authenticated,musicos_app} | (tenant_id = ( SELECT app_current_tenant_id() AS app_current_tenant_id)) |  |
| ai_usage_logs | ai_usage_logs_tenant_insert | INSERT | {authenticated,musicos_app} |  | (tenant_id = ( SELECT app_current_tenant_id() AS app_current_tenant_id)) |
| ai_usage_logs | ai_usage_logs_tenant_select | SELECT | {authenticated,musicos_app} | (tenant_id = ( SELECT app_current_tenant_id() AS app_current_tenant_id)) |  |
| ai_usage_logs | ai_usage_logs_tenant_update | UPDATE | {authenticated,musicos_app} | (tenant_id = ( SELECT app_current_tenant_id() AS app_current_tenant_id)) | (tenant_id = ( SELECT app_current_tenant_id() AS app_current_tenant_id)) |
| ai_usage_logs | tenant_isolation | ALL | {public} | (tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid) |  |
| artist_goals | super_admin_full_access | ALL | {authenticated} | app_is_super_admin() | app_is_super_admin() |
| artist_goals | tenant_isolation | ALL | {authenticated} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| artist_platform_profiles | artist_platform_profiles_delete_tenant | DELETE | {authenticated} | (tenant_id = ( SELECT private_get_tenant_id() AS private_get_tenant_id)) |  |
| artist_platform_profiles | artist_platform_profiles_insert_tenant | INSERT | {authenticated} |  | (tenant_id = ( SELECT private_get_tenant_id() AS private_get_tenant_id)) |
| artist_platform_profiles | artist_platform_profiles_select_tenant | SELECT | {authenticated} | (tenant_id = ( SELECT private_get_tenant_id() AS private_get_tenant_id)) |  |
| artist_platform_profiles | artist_platform_profiles_update_tenant | UPDATE | {authenticated} | (tenant_id = ( SELECT private_get_tenant_id() AS private_get_tenant_id)) | (tenant_id = ( SELECT private_get_tenant_id() AS private_get_tenant_id)) |
| artist_platform_profiles | tenant_isolation | ALL | {public} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| artists | super_admin_full_access | ALL | {authenticated} | app_is_super_admin() | app_is_super_admin() |
| artists | tenant_isolation | ALL | {authenticated} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| asset_usage_logs | tenant_isolation | ALL | {public} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| asset_versions | tenant_isolation | ALL | {public} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| assets | tenant_isolation | ALL | {public} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| audiovisual_approvals | tenant_isolation | ALL | {public} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| audiovisual_assets | tenant_isolation | ALL | {public} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| audiovisual_briefings | tenant_isolation | ALL | {public} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| audiovisual_deliverables | tenant_isolation | ALL | {public} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| audiovisual_production_days | tenant_isolation | ALL | {public} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| audiovisual_projects | tenant_isolation | ALL | {authenticated} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| audiovisual_shots | tenant_isolation | ALL | {public} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| audiovisual_tasks | tenant_isolation | ALL | {public} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| audiovisual_team_members | tenant_isolation | ALL | {public} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| audit_logs | super_admin_full_access | ALL | {authenticated} | app_is_super_admin() | app_is_super_admin() |
| audit_logs | tenant_isolation | ALL | {authenticated} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| billing_plans | billing_plans_read_public | SELECT | {public} | true |  |
| billing_settings | billing_settings_admin | ALL | {authenticated} | app_is_super_admin() | app_is_super_admin() |
| billing_settings | billing_settings_read | SELECT | {authenticated} | true |  |
| billing_subscriptions | org_isolation | ALL | {authenticated} | ((org_id)::text = app_current_org_id()) | ((org_id)::text = app_current_org_id()) |
| billing_subscriptions | super_admin_full_access | ALL | {authenticated} | app_is_super_admin() | app_is_super_admin() |
| briefings | super_admin_full_access | ALL | {authenticated} | app_is_super_admin() | app_is_super_admin() |
| briefings | tenant_isolation | ALL | {authenticated} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| budget_revisions | budget_revisions_isolation | ALL | {public} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| budget_revisions | migrator_admin_all | ALL | {musicos_migrator} | true | true |
| budgets | budgets_isolation | ALL | {public} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| budgets | migrator_admin_all | ALL | {musicos_migrator} | true | true |
| campaign_assets | campaign_assets_tenant_delete | DELETE | {authenticated,musicos_app} | (tenant_id = ( SELECT app_current_tenant_id() AS app_current_tenant_id)) |  |
| campaign_assets | campaign_assets_tenant_insert | INSERT | {authenticated,musicos_app} |  | (tenant_id = ( SELECT app_current_tenant_id() AS app_current_tenant_id)) |
| campaign_assets | campaign_assets_tenant_select | SELECT | {authenticated,musicos_app} | (tenant_id = ( SELECT app_current_tenant_id() AS app_current_tenant_id)) |  |
| campaign_assets | campaign_assets_tenant_update | UPDATE | {authenticated,musicos_app} | (tenant_id = ( SELECT app_current_tenant_id() AS app_current_tenant_id)) | (tenant_id = ( SELECT app_current_tenant_id() AS app_current_tenant_id)) |
| campaign_assets | tenant_isolation | ALL | {public} | (tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid) |  |
| campaign_tasks | campaign_tasks_tenant_delete | DELETE | {authenticated,musicos_app} | (tenant_id = ( SELECT app_current_tenant_id() AS app_current_tenant_id)) |  |
| campaign_tasks | campaign_tasks_tenant_insert | INSERT | {authenticated,musicos_app} |  | (tenant_id = ( SELECT app_current_tenant_id() AS app_current_tenant_id)) |
| campaign_tasks | campaign_tasks_tenant_select | SELECT | {authenticated,musicos_app} | (tenant_id = ( SELECT app_current_tenant_id() AS app_current_tenant_id)) |  |
| campaign_tasks | campaign_tasks_tenant_update | UPDATE | {authenticated,musicos_app} | (tenant_id = ( SELECT app_current_tenant_id() AS app_current_tenant_id)) | (tenant_id = ( SELECT app_current_tenant_id() AS app_current_tenant_id)) |
| campaign_tasks | tenant_isolation | ALL | {public} | (tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid) |  |
| campaigns | super_admin_full_access | ALL | {authenticated} | app_is_super_admin() | app_is_super_admin() |
| campaigns | tenant_isolation | ALL | {authenticated} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| client_attachments | super_admin_full_access | ALL | {authenticated} | app_is_super_admin() | app_is_super_admin() |
| client_attachments | tenant_isolation | ALL | {authenticated} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| clients | super_admin_full_access | ALL | {authenticated} | app_is_super_admin() | app_is_super_admin() |
| clients | tenant_isolation | ALL | {authenticated} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| content_detections | super_admin_full_access | ALL | {authenticated} | app_is_super_admin() | app_is_super_admin() |
| content_detections | tenant_isolation | ALL | {authenticated} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| contract_service_types | contract_service_types_isolation | ALL | {public} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| contract_templates | super_admin_full_access | ALL | {authenticated} | app_is_super_admin() | app_is_super_admin() |
| contract_templates | tenant_isolation | ALL | {authenticated} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| contracts | super_admin_full_access | ALL | {authenticated} | app_is_super_admin() | app_is_super_admin() |
| contracts | tenant_isolation | ALL | {authenticated} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| conversation_messages | tenant_isolation | ALL | {public} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| conversation_notes | tenant_isolation | ALL | {public} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| conversations | tenant_isolation | ALL | {public} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| cost_centers | cost_centers_isolation | ALL | {public} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| cost_centers | migrator_admin_all | ALL | {musicos_migrator} | true | true |
| counterparties | counterparties_isolation | ALL | {public} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| counterparties | migrator_admin_all | ALL | {musicos_migrator} | true | true |
| departments | super_admin_full_access | ALL | {authenticated} | (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'super_admin'::text) | (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'super_admin'::text) |
| departments | tenant_isolation | ALL | {authenticated} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| domain_event_log | super_admin_full_access | ALL | {authenticated} | app_is_super_admin() | app_is_super_admin() |
| domain_event_log | tenant_isolation | ALL | {authenticated} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| ecad_reports | super_admin_full_access | ALL | {authenticated} | app_is_super_admin() | app_is_super_admin() |
| ecad_reports | tenant_isolation | ALL | {authenticated} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| employees | super_admin_full_access | ALL | {authenticated} | app_is_super_admin() | app_is_super_admin() |
| employees | tenant_isolation | ALL | {authenticated} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| events | super_admin_full_access | ALL | {authenticated} | app_is_super_admin() | app_is_super_admin() |
| events | tenant_isolation | ALL | {authenticated} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| external_identifiers | tenant_isolation | ALL | {public} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| financial_accounts | financial_accounts_isolation | ALL | {public} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| financial_accounts | migrator_admin_all | ALL | {musicos_migrator} | true | true |
| financial_categories | financial_categories_isolation | ALL | {public} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| financial_categories | migrator_admin_all | ALL | {musicos_migrator} | true | true |
| financial_category_audit_logs | tenant_isolation_financial_category_audit_logs | ALL | {public} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| financial_category_templates | financial_category_templates_read_all | SELECT | {public} | true |  |
| financial_category_templates | migrator_admin_all | ALL | {musicos_migrator} | true | true |
| financial_rules | tenant_isolation | ALL | {public} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| financial_transactions | financial_transactions_isolation | ALL | {public} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| financial_transactions | migrator_admin_all | ALL | {musicos_migrator} | true | true |
| form_submissions | tenant_isolation | ALL | {public} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| forms | tenant_isolation | ALL | {public} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| integrations | super_admin_full_access | ALL | {authenticated} | app_is_super_admin() | app_is_super_admin() |
| integrations | tenant_isolation | ALL | {authenticated} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| inventory_items | tenant_isolation | ALL | {authenticated} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| invoices | super_admin_full_access | ALL | {authenticated} | app_is_super_admin() | app_is_super_admin() |
| invoices | tenant_isolation | ALL | {authenticated} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| job_functions | super_admin_full_access | ALL | {authenticated} | (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'super_admin'::text) | (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'super_admin'::text) |
| job_functions | tenant_isolation | ALL | {authenticated} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| lead_interactions | super_admin_full_access | ALL | {authenticated} | app_is_super_admin() | app_is_super_admin() |
| lead_interactions | tenant_isolation | ALL | {authenticated} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| lead_uploads | lead_uploads_tenant_delete | DELETE | {authenticated,musicos_app} | (tenant_id = ( SELECT app_current_tenant_id() AS app_current_tenant_id)) |  |
| lead_uploads | lead_uploads_tenant_insert | INSERT | {authenticated,musicos_app} |  | (tenant_id = ( SELECT app_current_tenant_id() AS app_current_tenant_id)) |
| lead_uploads | lead_uploads_tenant_select | SELECT | {authenticated,musicos_app} | (tenant_id = ( SELECT app_current_tenant_id() AS app_current_tenant_id)) |  |
| lead_uploads | lead_uploads_tenant_update | UPDATE | {authenticated,musicos_app} | (tenant_id = ( SELECT app_current_tenant_id() AS app_current_tenant_id)) | (tenant_id = ( SELECT app_current_tenant_id() AS app_current_tenant_id)) |
| leads | super_admin_full_access | ALL | {authenticated} | app_is_super_admin() | app_is_super_admin() |
| leads | tenant_isolation | ALL | {authenticated} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| leave_requests | super_admin_full_access | ALL | {authenticated} | app_is_super_admin() | app_is_super_admin() |
| leave_requests | tenant_isolation | ALL | {authenticated} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| licenses | tenant_isolation | ALL | {authenticated} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| marketing_asset_approvals | tenant_isolation | ALL | {public} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| marketing_asset_versions | tenant_isolation | ALL | {public} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| marketing_assets | tenant_isolation | ALL | {public} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| marketing_content_posts | tenant_isolation | ALL | {public} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| marketing_projects | tenant_isolation | ALL | {authenticated} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| marketing_strategies | tenant_isolation | ALL | {public} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| marketing_strategy_actions | tenant_isolation | ALL | {public} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| marketing_strategy_initiatives | tenant_isolation | ALL | {public} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| marketing_strategy_objectives | tenant_isolation | ALL | {public} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| marketing_tasks | tenant_isolation | ALL | {authenticated} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| membership_job_functions | super_admin_full_access | ALL | {authenticated} | (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'super_admin'::text) | (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'super_admin'::text) |
| membership_job_functions | tenant_isolation | ALL | {authenticated} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| musicchat_automation_events | tenant_isolation | ALL | {public} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| musicchat_automation_notifications | tenant_isolation | ALL | {public} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| musicchat_automation_settings | tenant_isolation | ALL | {public} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| musicos360_migrations | migrator_admin_all | ALL | {musicos_migrator} | true | true |
| notification_settings | tenant_isolation | ALL | {public} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| notifications | super_admin_full_access | ALL | {authenticated} | app_is_super_admin() | app_is_super_admin() |
| notifications | tenant_isolation | ALL | {authenticated} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| oauth_connections | super_admin_full_access | ALL | {authenticated} | app_is_super_admin() | app_is_super_admin() |
| oauth_connections | tenant_isolation | ALL | {authenticated} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| operational_list_items | migrator_admin_all | ALL | {musicos_migrator} | true | true |
| operational_list_items | operational_list_items_isolation | ALL | {public} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| operational_tasks | operational_tasks_tenant_delete | DELETE | {authenticated,musicos_app} | (tenant_id = ( SELECT app_current_tenant_id() AS app_current_tenant_id)) |  |
| operational_tasks | operational_tasks_tenant_insert | INSERT | {authenticated,musicos_app} |  | (tenant_id = ( SELECT app_current_tenant_id() AS app_current_tenant_id)) |
| operational_tasks | operational_tasks_tenant_select | SELECT | {authenticated,musicos_app} | (tenant_id = ( SELECT app_current_tenant_id() AS app_current_tenant_id)) |  |
| operational_tasks | operational_tasks_tenant_update | UPDATE | {authenticated,musicos_app} | (tenant_id = ( SELECT app_current_tenant_id() AS app_current_tenant_id)) | (tenant_id = ( SELECT app_current_tenant_id() AS app_current_tenant_id)) |
| org_members | super_admin_full_access | ALL | {authenticated} | app_is_super_admin() | app_is_super_admin() |
| org_members | tenant_isolation | ALL | {authenticated} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| organizations | org_isolation | ALL | {authenticated} | ((id)::text = app_current_org_id()) | ((id)::text = app_current_org_id()) |
| organizations | super_admin_full_access | ALL | {authenticated} | app_is_super_admin() | app_is_super_admin() |
| payment_events | payment_events_access | ALL | {authenticated} | ((app_current_tenant_id() IS NULL) OR (tenant_id IS NULL) OR (tenant_id = app_current_tenant_id())) | ((app_current_tenant_id() IS NULL) OR (tenant_id IS NULL) OR (tenant_id = app_current_tenant_id())) |
| payment_events | super_admin_full_access | ALL | {authenticated} | app_is_super_admin() | app_is_super_admin() |
| payroll_entries | super_admin_full_access | ALL | {authenticated} | app_is_super_admin() | app_is_super_admin() |
| payroll_entries | tenant_isolation | ALL | {authenticated} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| performance_metric_entries | migrator_admin_all | ALL | {musicos_migrator} | true | true |
| performance_metric_entries | performance_metric_entries_isolation | ALL | {public} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| permission_aliases | permission_aliases_deny_all | ALL | {public} | false | false |
| permission_conflicts | musicos_app_access | ALL | {musicos_app} | true | true |
| permission_dependencies | musicos_app_access | ALL | {musicos_app} | true | true |
| permission_groups | permission_groups_deny_all | ALL | {public} | false | false |
| permissions | musicos_app_access | ALL | {musicos_app} | true | true |
| phonograms | super_admin_full_access | ALL | {authenticated} | app_is_super_admin() | app_is_super_admin() |
| phonograms | tenant_isolation | ALL | {authenticated} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| pipeline_opportunities | tenant_isolation | ALL | {public} | (tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid) |  |
| pipeline_stages | tenant_isolation | ALL | {public} | (tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid) |  |
| pipelines | tenant_isolation | ALL | {public} | (tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid) |  |
| positions | super_admin_full_access | ALL | {authenticated} | (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'super_admin'::text) | (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'super_admin'::text) |
| positions | tenant_isolation | ALL | {authenticated} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| project_assets | tenant_isolation | ALL | {public} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| project_track_participants | tenant_isolation | ALL | {public} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| project_tracks | tenant_isolation | ALL | {public} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| projects | super_admin_full_access | ALL | {authenticated} | app_is_super_admin() | app_is_super_admin() |
| projects | tenant_isolation | ALL | {authenticated} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| rbac_decision_logs | super_admin_full_access | ALL | {authenticated} | app_is_super_admin() | app_is_super_admin() |
| rbac_decision_logs | tenant_isolation | ALL | {authenticated} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| rbac_decision_logs_2026_06 | super_admin_full_access | ALL | {authenticated} | app_is_super_admin() | app_is_super_admin() |
| rbac_decision_logs_2026_06 | tenant_isolation | ALL | {authenticated} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| rbac_decision_logs_2026_07 | super_admin_full_access | ALL | {authenticated} | app_is_super_admin() | app_is_super_admin() |
| rbac_decision_logs_2026_07 | tenant_isolation | ALL | {authenticated} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| rbac_decision_logs_2026_08 | super_admin_full_access | ALL | {authenticated} | app_is_super_admin() | app_is_super_admin() |
| rbac_decision_logs_2026_08 | tenant_isolation | ALL | {authenticated} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| rbac_decision_logs_2026_09 | super_admin_full_access | ALL | {authenticated} | app_is_super_admin() | app_is_super_admin() |
| rbac_decision_logs_2026_09 | tenant_isolation | ALL | {authenticated} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| rbac_decision_logs_2026_10 | super_admin_full_access | ALL | {authenticated} | app_is_super_admin() | app_is_super_admin() |
| rbac_decision_logs_2026_10 | tenant_isolation | ALL | {authenticated} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| rbac_decision_logs_default | super_admin_full_access | ALL | {authenticated} | app_is_super_admin() | app_is_super_admin() |
| rbac_decision_logs_default | tenant_isolation | ALL | {authenticated} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| rbac_error_logs | tenant_isolation_delete | DELETE | {authenticated} | ((tenant_id IS NULL) OR (tenant_id = private_get_tenant_id())) |  |
| rbac_error_logs | tenant_isolation_insert | INSERT | {authenticated} |  | ((tenant_id IS NULL) OR (tenant_id = private_get_tenant_id())) |
| rbac_error_logs | tenant_isolation_select | SELECT | {authenticated} | ((tenant_id IS NULL) OR (tenant_id = private_get_tenant_id())) |  |
| rbac_error_logs | tenant_isolation_update | UPDATE | {authenticated} | ((tenant_id IS NULL) OR (tenant_id = private_get_tenant_id())) | ((tenant_id IS NULL) OR (tenant_id = private_get_tenant_id())) |
| release_works | tenant_isolation | ALL | {authenticated} | ((EXISTS ( SELECT 1    FROM releases r   WHERE ((r.id = release_works.release_id) AND (r.tenant_id = private_get_tenant_id())))) AND (EXISTS ( SELECT 1    FROM works w   WHERE ((w.id = release_works.work_id) AND (w.tenant_id = private_get_tenant_id()))))) | ((EXISTS ( SELECT 1    FROM releases r   WHERE ((r.id = release_works.release_id) AND (r.tenant_id = private_get_tenant_id())))) AND (EXISTS ( SELECT 1    FROM works w   WHERE ((w.id = release_works.work_id) AND (w.tenant_id = private_get_tenant_id()))))) |
| releases | super_admin_full_access | ALL | {authenticated} | app_is_super_admin() | app_is_super_admin() |
| releases | tenant_isolation | ALL | {authenticated} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| rights_holders | tenant_isolation | ALL | {authenticated} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| role_inheritance | role_inheritance_read | SELECT | {public} | ((tenant_id IS NULL) OR (tenant_id = private_get_tenant_id())) |  |
| role_inheritance | role_inheritance_tenant_delete | DELETE | {public} | ((tenant_id IS NOT NULL) AND (tenant_id = private_get_tenant_id())) |  |
| role_inheritance | role_inheritance_tenant_delete_scope | DELETE | {public} | ((tenant_id IS NOT NULL) AND (tenant_id = private_get_tenant_id())) |  |
| role_inheritance | role_inheritance_tenant_insert | INSERT | {public} |  | ((tenant_id IS NOT NULL) AND (tenant_id = private_get_tenant_id())) |
| role_inheritance | role_inheritance_tenant_update | UPDATE | {public} | ((tenant_id IS NOT NULL) AND (tenant_id = private_get_tenant_id())) | ((tenant_id IS NOT NULL) AND (tenant_id = private_get_tenant_id())) |
| role_inheritance | role_inheritance_tenant_update_scope | UPDATE | {public} | ((tenant_id IS NOT NULL) AND (tenant_id = private_get_tenant_id())) | ((tenant_id IS NOT NULL) AND (tenant_id = private_get_tenant_id())) |
| role_permissions | musicos_app_access | ALL | {musicos_app} | true | true |
| role_template_permissions | musicos_app_access | ALL | {musicos_app} | true | true |
| role_templates | musicos_app_access | ALL | {musicos_app} | true | true |
| roles | roles_visibility | ALL | {authenticated} | ((tenant_id IS NULL) OR (tenant_id = private_get_tenant_id())) | (tenant_id = private_get_tenant_id()) |
| roles | super_admin_full_access | ALL | {authenticated} | (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'super_admin'::text) | (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'super_admin'::text) |
| shares | super_admin_full_access | ALL | {authenticated} | app_is_super_admin() | app_is_super_admin() |
| shares | tenant_isolation | ALL | {authenticated} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| skill_run_logs | tenant_isolation | ALL | {public} | (EXISTS ( SELECT 1    FROM skill_runs p   WHERE ((p.id = skill_run_logs.skill_run_id) AND (p.tenant_id = private_get_tenant_id())))) | (EXISTS ( SELECT 1    FROM skill_runs p   WHERE ((p.id = skill_run_logs.skill_run_id) AND (p.tenant_id = private_get_tenant_id())))) |
| skill_runs | tenant_isolation | ALL | {public} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| society_accounts | tenant_isolation | ALL | {public} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| society_payload_snapshots | tenant_isolation | ALL | {public} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| society_submission_events | tenant_isolation | ALL | {public} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| society_submissions | tenant_isolation | ALL | {public} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| society_sync_jobs | tenant_isolation | ALL | {public} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| society_validation_errors | tenant_isolation | ALL | {public} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| support_tickets | super_admin_full_access | ALL | {authenticated} | app_is_super_admin() | app_is_super_admin() |
| support_tickets | tenant_isolation | ALL | {authenticated} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| takedowns | super_admin_full_access | ALL | {authenticated} | app_is_super_admin() | app_is_super_admin() |
| takedowns | tenant_isolation | ALL | {authenticated} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| task_assets | tenant_isolation | ALL | {public} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| tenant_billing_state | super_admin_full_access | ALL | {authenticated} | app_is_super_admin() | app_is_super_admin() |
| tenant_billing_state | tenant_billing_state_access | ALL | {authenticated} | ((app_current_tenant_id() IS NULL) OR (tenant_id = app_current_tenant_id())) | ((app_current_tenant_id() IS NULL) OR (tenant_id = app_current_tenant_id())) |
| tenant_invitations | tenant_invitations_isolation | ALL | {public} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| tenants | org_isolation | ALL | {authenticated} | ((org_id)::text = app_current_org_id()) | ((org_id)::text = app_current_org_id()) |
| tenants | super_admin_full_access | ALL | {authenticated} | app_is_super_admin() | app_is_super_admin() |
| transaction_allocations | migrator_admin_all | ALL | {musicos_migrator} | true | true |
| transaction_allocations | transaction_allocations_isolation | ALL | {public} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| transactions | super_admin_full_access | ALL | {authenticated} | app_is_super_admin() | app_is_super_admin() |
| transactions | tenant_isolation | ALL | {authenticated} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| uploads | super_admin_full_access | ALL | {authenticated} | app_is_super_admin() | app_is_super_admin() |
| uploads | tenant_isolation | ALL | {authenticated} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| users | users_deny_all | ALL | {public} | false | false |
| webhook_events | super_admin_full_access | ALL | {authenticated} | app_is_super_admin() | app_is_super_admin() |
| webhook_events | tenant_isolation | ALL | {authenticated} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| work_participants | tenant_isolation | ALL | {public} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| workflow_execution_logs | tenant_isolation | ALL | {public} | (EXISTS ( SELECT 1    FROM workflow_executions p   WHERE ((p.id = workflow_execution_logs.execution_id) AND (p.tenant_id = private_get_tenant_id())))) | (EXISTS ( SELECT 1    FROM workflow_executions p   WHERE ((p.id = workflow_execution_logs.execution_id) AND (p.tenant_id = private_get_tenant_id())))) |
| workflow_executions | tenant_isolation | ALL | {public} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| workflow_transitions | super_admin_full_access | ALL | {authenticated} | app_is_super_admin() | app_is_super_admin() |
| workflow_transitions | tenant_isolation | ALL | {authenticated} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |
| works | super_admin_full_access | ALL | {authenticated} | app_is_super_admin() | app_is_super_admin() |
| works | tenant_isolation | ALL | {authenticated} | (tenant_id = private_get_tenant_id()) | (tenant_id = private_get_tenant_id()) |

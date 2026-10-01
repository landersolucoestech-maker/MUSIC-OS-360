> Historical record. Kept as recorded; not the current contract.

# Constraints — Schema `public`

## Foreign Keys (191)

| SOURCE_TABLE | SOURCE_COLUMN | TARGET_SCHEMA | TARGET_TABLE | TARGET_COLUMN | ON_DELETE | ON_UPDATE | CONSTRAINT_NAME |
|---|---|---|---|---|---|---|---|
| artist_platform_profiles | artist_id | public | artists | id | CASCADE | NO ACTION | FK_artist_platform_profiles_artist |
| audiovisual_projects | tenant_id | public | projects | id | NO ACTION | NO ACTION | fk_audiovisual_projects_financial_project |
| audiovisual_projects | tenant_id | public | projects | tenant_id | NO ACTION | NO ACTION | fk_audiovisual_projects_financial_project |
| audiovisual_projects | financial_project_id | public | projects | id | NO ACTION | NO ACTION | fk_audiovisual_projects_financial_project |
| audiovisual_projects | financial_project_id | public | projects | tenant_id | NO ACTION | NO ACTION | fk_audiovisual_projects_financial_project |
| briefings | campanha_id | public | campaigns | id | SET NULL | NO ACTION | fk_briefings_campanha_id |
| budget_revisions | budget_id | public | budgets | id | CASCADE | NO ACTION | fk_budget_revisions_budget |
| budget_revisions | budget_id | public | budgets | tenant_id | CASCADE | NO ACTION | fk_budget_revisions_budget |
| budget_revisions | tenant_id | public | budgets | id | CASCADE | NO ACTION | fk_budget_revisions_budget |
| budget_revisions | tenant_id | public | budgets | tenant_id | CASCADE | NO ACTION | fk_budget_revisions_budget |
| budgets | project_id | public | projects | id | NO ACTION | NO ACTION | fk_budgets_project |
| budgets | tenant_id | public | projects | id | NO ACTION | NO ACTION | fk_budgets_project |
| budgets | project_id | public | projects | tenant_id | NO ACTION | NO ACTION | fk_budgets_project |
| budgets | tenant_id | public | projects | tenant_id | NO ACTION | NO ACTION | fk_budgets_project |
| campaign_assets | campaign_id | public | campaigns | id | CASCADE | NO ACTION | campaign_assets_campaign_id_fkey |
| campaign_assets | tenant_id | public | campaigns | tenant_id | CASCADE | NO ACTION | fk_campaign_assets_campaign_tenant |
| campaign_assets | tenant_id | public | campaigns | id | CASCADE | NO ACTION | fk_campaign_assets_campaign_tenant |
| campaign_assets | campaign_id | public | campaigns | tenant_id | CASCADE | NO ACTION | fk_campaign_assets_campaign_tenant |
| campaign_assets | campaign_id | public | campaigns | id | CASCADE | NO ACTION | fk_campaign_assets_campaign_tenant |
| campaign_tasks | campaign_id | public | campaigns | id | CASCADE | NO ACTION | campaign_tasks_campaign_id_fkey |
| campaign_tasks | tenant_id | public | campaigns | tenant_id | CASCADE | NO ACTION | fk_campaign_tasks_campaign_tenant |
| campaign_tasks | tenant_id | public | campaigns | id | CASCADE | NO ACTION | fk_campaign_tasks_campaign_tenant |
| campaign_tasks | campaign_id | public | campaigns | tenant_id | CASCADE | NO ACTION | fk_campaign_tasks_campaign_tenant |
| campaign_tasks | campaign_id | public | campaigns | id | CASCADE | NO ACTION | fk_campaign_tasks_campaign_tenant |
| client_attachments | tenant_id | public | clients | id | NO ACTION | NO ACTION | fk_client_attachments_client |
| client_attachments | client_id | public | clients | tenant_id | NO ACTION | NO ACTION | fk_client_attachments_client |
| client_attachments | client_id | public | clients | id | NO ACTION | NO ACTION | fk_client_attachments_client |
| client_attachments | tenant_id | public | clients | tenant_id | NO ACTION | NO ACTION | fk_client_attachments_client |
| contract_service_types | tenant_id | public | tenants | id | CASCADE | NO ACTION | contract_service_types_tenant_id_fkey |
| contracts | artista_id | public | artists | id | SET NULL | NO ACTION | fk_contracts_artista_id |
| conversation_messages | conversation_id | public | conversations | id | CASCADE | NO ACTION | conversation_messages_conversation_id_fkey |
| conversation_notes | conversation_id | public | conversations | id | CASCADE | NO ACTION | conversation_notes_conversation_id_fkey |
| conversations | contact_id | public | leads | id | SET NULL | NO ACTION | conversations_contact_id_fkey |
| conversations | tenant_id | public | tenants | id | CASCADE | NO ACTION | conversations_tenant_id_fkey |
| counterparties | artist_id | public | artists | id | NO ACTION | NO ACTION | fk_counterparties_artist |
| counterparties | tenant_id | public | artists | tenant_id | NO ACTION | NO ACTION | fk_counterparties_artist |
| counterparties | tenant_id | public | artists | id | NO ACTION | NO ACTION | fk_counterparties_artist |
| counterparties | artist_id | public | artists | tenant_id | NO ACTION | NO ACTION | fk_counterparties_artist |
| counterparties | client_id | public | clients | id | NO ACTION | NO ACTION | fk_counterparties_client |
| counterparties | tenant_id | public | clients | tenant_id | NO ACTION | NO ACTION | fk_counterparties_client |
| counterparties | client_id | public | clients | tenant_id | NO ACTION | NO ACTION | fk_counterparties_client |
| counterparties | tenant_id | public | clients | id | NO ACTION | NO ACTION | fk_counterparties_client |
| departments | parent_department_id | public | departments | id | SET NULL | NO ACTION | fk_departments_parent |
| departments | tenant_id | public | tenants | id | CASCADE | NO ACTION | fk_departments_tenant |
| financial_categories | template_id | public | financial_category_templates | id | NO ACTION | NO ACTION | financial_categories_template_id_fkey |
| financial_categories | parent_id | public | financial_categories | tenant_id | NO ACTION | NO ACTION | fk_financial_categories_parent |
| financial_categories | parent_id | public | financial_categories | id | NO ACTION | NO ACTION | fk_financial_categories_parent |
| financial_categories | tenant_id | public | financial_categories | tenant_id | NO ACTION | NO ACTION | fk_financial_categories_parent |
| financial_categories | tenant_id | public | financial_categories | id | NO ACTION | NO ACTION | fk_financial_categories_parent |
| financial_category_templates | parent_id | public | financial_category_templates | id | NO ACTION | NO ACTION | financial_category_templates_parent_id_fkey |
| financial_transactions | account_id | public | financial_accounts | id | NO ACTION | NO ACTION | fk_fintx_account |
| financial_transactions | tenant_id | public | financial_accounts | id | NO ACTION | NO ACTION | fk_fintx_account |
| financial_transactions | account_id | public | financial_accounts | tenant_id | NO ACTION | NO ACTION | fk_fintx_account |
| financial_transactions | tenant_id | public | financial_accounts | tenant_id | NO ACTION | NO ACTION | fk_fintx_account |
| financial_transactions | tenant_id | public | financial_categories | id | NO ACTION | NO ACTION | fk_fintx_category |
| financial_transactions | category_id | public | financial_categories | tenant_id | NO ACTION | NO ACTION | fk_fintx_category |
| financial_transactions | category_id | public | financial_categories | id | NO ACTION | NO ACTION | fk_fintx_category |
| financial_transactions | tenant_id | public | financial_categories | tenant_id | NO ACTION | NO ACTION | fk_fintx_category |
| financial_transactions | contract_id | public | contracts | id | NO ACTION | NO ACTION | fk_fintx_contract |
| financial_transactions | tenant_id | public | contracts | tenant_id | NO ACTION | NO ACTION | fk_fintx_contract |
| financial_transactions | tenant_id | public | contracts | id | NO ACTION | NO ACTION | fk_fintx_contract |
| financial_transactions | contract_id | public | contracts | tenant_id | NO ACTION | NO ACTION | fk_fintx_contract |
| financial_transactions | tenant_id | public | cost_centers | tenant_id | NO ACTION | NO ACTION | fk_fintx_cost_center |
| financial_transactions | tenant_id | public | cost_centers | id | NO ACTION | NO ACTION | fk_fintx_cost_center |
| financial_transactions | cost_center_id | public | cost_centers | tenant_id | NO ACTION | NO ACTION | fk_fintx_cost_center |
| financial_transactions | cost_center_id | public | cost_centers | id | NO ACTION | NO ACTION | fk_fintx_cost_center |
| financial_transactions | tenant_id | public | financial_accounts | tenant_id | NO ACTION | NO ACTION | fk_fintx_counter_account |
| financial_transactions | counter_account_id | public | financial_accounts | tenant_id | NO ACTION | NO ACTION | fk_fintx_counter_account |
| financial_transactions | tenant_id | public | financial_accounts | id | NO ACTION | NO ACTION | fk_fintx_counter_account |
| financial_transactions | counter_account_id | public | financial_accounts | id | NO ACTION | NO ACTION | fk_fintx_counter_account |
| financial_transactions | counterparty_id | public | counterparties | tenant_id | NO ACTION | NO ACTION | fk_fintx_counterparty |
| financial_transactions | tenant_id | public | counterparties | id | NO ACTION | NO ACTION | fk_fintx_counterparty |
| financial_transactions | tenant_id | public | counterparties | tenant_id | NO ACTION | NO ACTION | fk_fintx_counterparty |
| financial_transactions | counterparty_id | public | counterparties | id | NO ACTION | NO ACTION | fk_fintx_counterparty |
| financial_transactions | tenant_id | public | events | tenant_id | NO ACTION | NO ACTION | fk_fintx_event |
| financial_transactions | tenant_id | public | events | id | NO ACTION | NO ACTION | fk_fintx_event |
| financial_transactions | event_id | public | events | id | NO ACTION | NO ACTION | fk_fintx_event |
| financial_transactions | event_id | public | events | tenant_id | NO ACTION | NO ACTION | fk_fintx_event |
| financial_transactions | reversal_of_id | public | financial_transactions | id | NO ACTION | NO ACTION | fk_fintx_reversal_of |
| financial_transactions | tenant_id | public | financial_transactions | tenant_id | NO ACTION | NO ACTION | fk_fintx_reversal_of |
| financial_transactions | tenant_id | public | financial_transactions | id | NO ACTION | NO ACTION | fk_fintx_reversal_of |
| financial_transactions | reversal_of_id | public | financial_transactions | tenant_id | NO ACTION | NO ACTION | fk_fintx_reversal_of |
| form_submissions | form_id | public | forms | id | CASCADE | NO ACTION | form_submissions_form_id_fkey |
| form_submissions | lead_id | public | leads | id | SET NULL | NO ACTION | form_submissions_lead_id_fkey |
| forms | tenant_id | public | tenants | id | CASCADE | NO ACTION | forms_tenant_id_fkey |
| job_functions | tenant_id | public | tenants | id | CASCADE | NO ACTION | fk_job_functions_tenant |
| lead_interactions | lead_id | public | leads | id | CASCADE | NO ACTION | fk_lead_interactions_lead_id |
| lead_uploads | lead_id | public | leads | id | CASCADE | NO ACTION | lead_uploads_lead_id_fkey |
| leave_requests | employee_id | public | employees | id | RESTRICT | NO ACTION | fk_leave_requests_employee_id |
| marketing_asset_approvals | asset_id | public | marketing_assets | id | CASCADE | NO ACTION | marketing_asset_approvals_asset_id_fkey |
| marketing_asset_approvals | version_id | public | marketing_asset_versions | id | CASCADE | NO ACTION | marketing_asset_approvals_version_id_fkey |
| marketing_asset_versions | asset_id | public | marketing_assets | id | CASCADE | NO ACTION | marketing_asset_versions_asset_id_fkey |
| marketing_assets | current_version_id | public | marketing_asset_versions | id | NO ACTION | NO ACTION | fk_marketing_assets_current_version |
| marketing_content_posts | tenant_id | public | tenants | id | CASCADE | NO ACTION | marketing_content_posts_tenant_id_fkey |
| marketing_projects | financial_project_id | public | projects | id | NO ACTION | NO ACTION | fk_marketing_projects_financial_project |
| marketing_projects | tenant_id | public | projects | id | NO ACTION | NO ACTION | fk_marketing_projects_financial_project |
| marketing_projects | tenant_id | public | projects | tenant_id | NO ACTION | NO ACTION | fk_marketing_projects_financial_project |
| marketing_projects | financial_project_id | public | projects | tenant_id | NO ACTION | NO ACTION | fk_marketing_projects_financial_project |
| membership_job_functions | job_function_id | public | job_functions | id | RESTRICT | NO ACTION | fk_mjf_jobfn |
| membership_job_functions | membership_id | public | org_members | id | CASCADE | NO ACTION | fk_mjf_membership |
| membership_job_functions | tenant_id | public | tenants | id | CASCADE | NO ACTION | fk_mjf_tenant |
| musicchat_automation_events | conversation_id | public | conversations | id | CASCADE | NO ACTION | musicchat_automation_events_conversation_id_fkey |
| musicchat_automation_notifications | conversation_id | public | conversations | id | CASCADE | NO ACTION | musicchat_automation_notifications_conversation_id_fkey |
| notification_settings | tenant_id | public | tenants | id | CASCADE | NO ACTION | notification_settings_tenant_id_fkey |
| operational_list_items | tenant_id | public | tenants | id | CASCADE | NO ACTION | operational_list_items_tenant_id_fkey |
| org_members | department_id | public | departments | id | SET NULL | NO ACTION | fk_org_members_department |
| org_members | position_id | public | positions | id | SET NULL | NO ACTION | fk_org_members_position |
| org_members | role_id | public | roles | id | RESTRICT | NO ACTION | fk_org_members_role |
| payment_events | tenant_id | public | tenants | id | SET NULL | NO ACTION | payment_events_tenant_id_fkey |
| payroll_entries | employee_id | public | employees | id | RESTRICT | NO ACTION | fk_payroll_entries_employee_id |
| performance_metric_entries | artist_id | public | artists | id | NO ACTION | NO ACTION | fk_metric_artist |
| performance_metric_entries | tenant_id | public | artists | tenant_id | NO ACTION | NO ACTION | fk_metric_artist |
| performance_metric_entries | tenant_id | public | artists | id | NO ACTION | NO ACTION | fk_metric_artist |
| performance_metric_entries | artist_id | public | artists | tenant_id | NO ACTION | NO ACTION | fk_metric_artist |
| performance_metric_entries | tenant_id | public | phonograms | id | NO ACTION | NO ACTION | fk_metric_phonogram |
| performance_metric_entries | phonogram_id | public | phonograms | tenant_id | NO ACTION | NO ACTION | fk_metric_phonogram |
| performance_metric_entries | phonogram_id | public | phonograms | id | NO ACTION | NO ACTION | fk_metric_phonogram |
| performance_metric_entries | tenant_id | public | phonograms | tenant_id | NO ACTION | NO ACTION | fk_metric_phonogram |
| performance_metric_entries | project_id | public | projects | tenant_id | NO ACTION | NO ACTION | fk_metric_project |
| performance_metric_entries | tenant_id | public | projects | id | NO ACTION | NO ACTION | fk_metric_project |
| performance_metric_entries | tenant_id | public | projects | tenant_id | NO ACTION | NO ACTION | fk_metric_project |
| performance_metric_entries | project_id | public | projects | id | NO ACTION | NO ACTION | fk_metric_project |
| performance_metric_entries | release_id | public | releases | id | NO ACTION | NO ACTION | fk_metric_release |
| performance_metric_entries | release_id | public | releases | tenant_id | NO ACTION | NO ACTION | fk_metric_release |
| performance_metric_entries | tenant_id | public | releases | id | NO ACTION | NO ACTION | fk_metric_release |
| performance_metric_entries | tenant_id | public | releases | tenant_id | NO ACTION | NO ACTION | fk_metric_release |
| performance_metric_entries | tenant_id | public | performance_metric_entries | id | NO ACTION | NO ACTION | fk_metric_superseded_by |
| performance_metric_entries | superseded_by_id | public | performance_metric_entries | tenant_id | NO ACTION | NO ACTION | fk_metric_superseded_by |
| performance_metric_entries | superseded_by_id | public | performance_metric_entries | id | NO ACTION | NO ACTION | fk_metric_superseded_by |
| performance_metric_entries | tenant_id | public | performance_metric_entries | tenant_id | NO ACTION | NO ACTION | fk_metric_superseded_by |
| permission_conflicts | conflicts_with_permission_id | public | permissions | id | CASCADE | NO ACTION | fk_permission_conflicts_conflicts_with |
| permission_conflicts | permission_id | public | permissions | id | CASCADE | NO ACTION | fk_permission_conflicts_permission |
| permission_dependencies | depends_on_permission_id | public | permissions | id | CASCADE | NO ACTION | fk_permission_dependencies_depends_on |
| permission_dependencies | permission_id | public | permissions | id | CASCADE | NO ACTION | fk_permission_dependencies_permission |
| permissions | group_id | public | permission_groups | id | RESTRICT | NO ACTION | fk_permissions_group |
| phonograms | artista_id | public | artists | id | SET NULL | NO ACTION | fk_phonograms_artista_id |
| phonograms | obra_id | public | works | id | SET NULL | NO ACTION | fk_phonograms_obra_id |
| pipeline_opportunities | pipeline_id | public | pipelines | id | CASCADE | NO ACTION | pipeline_opportunities_pipeline_id_fkey |
| pipeline_opportunities | stage_id | public | pipeline_stages | id | SET NULL | NO ACTION | pipeline_opportunities_stage_id_fkey |
| pipeline_stages | pipeline_id | public | pipelines | id | CASCADE | NO ACTION | pipeline_stages_pipeline_id_fkey |
| positions | department_id | public | departments | id | SET NULL | NO ACTION | fk_positions_department |
| positions | tenant_id | public | tenants | id | CASCADE | NO ACTION | fk_positions_tenant |
| project_track_participants | project_track_id | public | project_tracks | id | CASCADE | NO ACTION | project_track_participants_project_track_id_fkey |
| project_tracks | project_id | public | projects | id | CASCADE | NO ACTION | project_tracks_project_id_fkey |
| release_works | release_id | public | releases | id | CASCADE | NO ACTION | FK_release_works_release |
| release_works | work_id | public | works | id | CASCADE | NO ACTION | FK_release_works_work |
| releases | artista_id | public | artists | id | SET NULL | NO ACTION | fk_releases_artista_id |
| role_inheritance | child_role_id | public | roles | id | CASCADE | NO ACTION | fk_role_inheritance_child_role |
| role_inheritance | created_by | public | users | id | SET NULL | NO ACTION | fk_role_inheritance_created_by |
| role_inheritance | parent_role_id | public | roles | id | RESTRICT | NO ACTION | fk_role_inheritance_parent_role |
| role_inheritance | tenant_id | public | tenants | id | CASCADE | NO ACTION | fk_role_inheritance_tenant |
| role_inheritance | updated_by | public | users | id | SET NULL | NO ACTION | fk_role_inheritance_updated_by |
| role_permissions | permission_id | public | permissions | id | RESTRICT | NO ACTION | fk_rp_permission |
| role_permissions | role_id | public | roles | id | CASCADE | NO ACTION | fk_rp_role |
| role_template_permissions | permission_id | public | permissions | id | RESTRICT | NO ACTION | fk_role_template_permissions_permission |
| role_template_permissions | template_id | public | role_templates | id | CASCADE | NO ACTION | fk_role_template_permissions_template |
| roles | canonical_role_id | public | roles | id | SET NULL | NO ACTION | fk_roles_canonical |
| roles | created_by | public | users | id | SET NULL | NO ACTION | fk_roles_created_by |
| roles | tenant_id | public | tenants | id | CASCADE | NO ACTION | fk_roles_tenant |
| roles | updated_by | public | users | id | SET NULL | NO ACTION | fk_roles_updated_by |
| shares | obra_id | public | works | id | SET NULL | NO ACTION | fk_shares_obra_id |
| skill_run_logs | skill_run_id | public | skill_runs | id | CASCADE | NO ACTION | fk_skill_run_logs_skill_run |
| society_payload_snapshots | submission_id | public | society_submissions | id | CASCADE | NO ACTION | society_payload_snapshots_submission_id_fkey |
| society_submission_events | submission_id | public | society_submissions | id | CASCADE | NO ACTION | society_submission_events_submission_id_fkey |
| tenant_billing_state | tenant_id | public | tenants | id | CASCADE | NO ACTION | tenant_billing_state_tenant_id_fkey |
| tenant_invitations | org_id | public | organizations | id | CASCADE | NO ACTION | tenant_invitations_org_id_fkey |
| tenant_invitations | role_id | public | roles | id | RESTRICT | NO ACTION | tenant_invitations_role_id_fkey |
| tenant_invitations | tenant_id | public | tenants | id | CASCADE | NO ACTION | tenant_invitations_tenant_id_fkey |
| transaction_allocations | artist_id | public | artists | id | NO ACTION | NO ACTION | fk_txalloc_artist |
| transaction_allocations | artist_id | public | artists | tenant_id | NO ACTION | NO ACTION | fk_txalloc_artist |
| transaction_allocations | tenant_id | public | artists | id | NO ACTION | NO ACTION | fk_txalloc_artist |
| transaction_allocations | tenant_id | public | artists | tenant_id | NO ACTION | NO ACTION | fk_txalloc_artist |
| transaction_allocations | tenant_id | public | phonograms | id | NO ACTION | NO ACTION | fk_txalloc_phonogram |
| transaction_allocations | phonogram_id | public | phonograms | tenant_id | NO ACTION | NO ACTION | fk_txalloc_phonogram |
| transaction_allocations | tenant_id | public | phonograms | tenant_id | NO ACTION | NO ACTION | fk_txalloc_phonogram |
| transaction_allocations | phonogram_id | public | phonograms | id | NO ACTION | NO ACTION | fk_txalloc_phonogram |
| transaction_allocations | tenant_id | public | projects | tenant_id | NO ACTION | NO ACTION | fk_txalloc_project |
| transaction_allocations | project_id | public | projects | id | NO ACTION | NO ACTION | fk_txalloc_project |
| transaction_allocations | project_id | public | projects | tenant_id | NO ACTION | NO ACTION | fk_txalloc_project |
| transaction_allocations | tenant_id | public | projects | id | NO ACTION | NO ACTION | fk_txalloc_project |
| transaction_allocations | tenant_id | public | releases | id | NO ACTION | NO ACTION | fk_txalloc_release |
| transaction_allocations | release_id | public | releases | id | NO ACTION | NO ACTION | fk_txalloc_release |
| transaction_allocations | tenant_id | public | releases | tenant_id | NO ACTION | NO ACTION | fk_txalloc_release |
| transaction_allocations | release_id | public | releases | tenant_id | NO ACTION | NO ACTION | fk_txalloc_release |
| transaction_allocations | transaction_id | public | financial_transactions | id | CASCADE | NO ACTION | fk_txalloc_transaction |
| transaction_allocations | tenant_id | public | financial_transactions | tenant_id | CASCADE | NO ACTION | fk_txalloc_transaction |
| transaction_allocations | tenant_id | public | financial_transactions | id | CASCADE | NO ACTION | fk_txalloc_transaction |
| transaction_allocations | transaction_id | public | financial_transactions | tenant_id | CASCADE | NO ACTION | fk_txalloc_transaction |
| work_participants | work_id | public | works | id | CASCADE | NO ACTION | work_participants_work_id_fkey |
| workflow_execution_logs | execution_id | public | workflow_executions | id | CASCADE | NO ACTION | fk_workflow_execution_logs_execution |
| works | artista_id | public | artists | id | SET NULL | NO ACTION | fk_works_artista_id |

## Unique constraints (54 constraints)

| TABLE | CONSTRAINT_NAME | COLUMNS |
|---|---|---|
| artist_platform_profiles | UQ_artist_platform_profiles_tenant_artist_platform | tenant_id, artist_id, platform |
| artists | uq_artists_tenant_id_id | tenant_id, id |
| audiovisual_briefings | audiovisual_briefings_audiovisual_project_id_key | audiovisual_project_id |
| billing_plans | billing_plans_slug_key | slug |
| billing_settings | billing_settings_key_key | key |
| billing_subscriptions | billing_subscriptions_stripe_customer_id_key | stripe_customer_id |
| billing_subscriptions | billing_subscriptions_stripe_sub_id_key | stripe_sub_id |
| budget_revisions | uq_budget_revisions_tenant_id_id | tenant_id, id |
| budgets | uq_budgets_tenant_id_id | tenant_id, id |
| campaigns | ux_campaigns_id_tenant | id, tenant_id |
| clients | uq_clients_tenant_id_id | tenant_id, id |
| contracts | uq_contracts_tenant_id_id | tenant_id, id |
| cost_centers | uq_cost_centers_tenant_id_id | tenant_id, id |
| counterparties | uq_counterparties_tenant_id_id | tenant_id, id |
| events | uq_events_tenant_id_id | tenant_id, id |
| financial_accounts | uq_financial_accounts_tenant_id_id | tenant_id, id |
| financial_categories | uq_financial_categories_tenant_id_id | tenant_id, id |
| financial_categories | uq_financial_categories_tenant_parent_name | tenant_id, parent_id, name |
| financial_category_templates | uq_fincat_templates_parent_name | parent_id, name |
| financial_transactions | uq_financial_transactions_tenant_id_id | tenant_id, id |
| financial_transactions | uq_fintx_single_reversal | tenant_id, reversal_of_id |
| integrations | integrations_tenant_id_provider_key | tenant_id, provider |
| membership_job_functions | uq_mjf_membership_jobfn | membership_id, job_function_id |
| musicchat_automation_notifications | uq_musicchat_escalation_notification | tenant_id, conversation_id, level |
| musicchat_automation_settings | musicchat_automation_settings_tenant_id_key | tenant_id |
| notification_settings | uq_notification_settings_tenant_key | tenant_id, notification_key |
| oauth_connections | oauth_connections_tenant_id_user_id_provider_key | tenant_id, user_id, provider |
| org_members | org_members_tenant_id_auth_user_id_key | tenant_id, auth_user_id |
| organizations | organizations_external_auth_org_id_key | external_auth_org_id |
| organizations | organizations_slug_key | slug |
| payment_events | uq_payment_events_stripe_event_id | stripe_event_id |
| performance_metric_entries | uq_perf_metric_entries_tenant_id_id | tenant_id, id |
| permission_aliases | uq_permission_aliases_legacy_key | legacy_key |
| permission_conflicts | uq_permission_conflicts_normalized_pair | permission_id, conflicts_with_permission_id |
| permission_dependencies | uq_permission_dependencies_pair | permission_id, depends_on_permission_id |
| permission_groups | uq_permission_groups_key | key |
| permissions | uq_permissions_key | key |
| permissions | uq_permissions_resource_action | resource, action |
| phonograms | uq_phonograms_tenant_id_id | tenant_id, id |
| projects | uq_projects_tenant_id_id | tenant_id, id |
| releases | uq_releases_tenant_id_id | tenant_id, id |
| role_permissions | uq_role_permissions | role_id, permission_id |
| role_template_permissions | uq_role_template_permissions_template_permission | template_id, permission_id |
| role_templates | uq_role_templates_key | key |
| society_payload_snapshots | uq_society_snapshot_version | submission_id, version |
| support_tickets | support_tickets_ticket_number_key | ticket_number |
| tenant_billing_state | tenant_billing_state_tenant_id_key | tenant_id |
| tenants | tenants_external_auth_org_id_key | external_auth_org_id |
| tenants | tenants_slug_key | slug |
| transaction_allocations | uq_transaction_allocations_tenant_id_id | tenant_id, id |
| transaction_allocations | uq_txalloc_target_per_dimension | tenant_id, transaction_id, dimension, project_id, artist_id, phonogram_id, release_id |
| uploads | uploads_file_id_key | file_id |
| users | uq_users_auth_user_id | auth_user_id |
| webhook_events | webhook_events_external_id_key | external_id |

## Check constraints (1369)

| TABLE | CONSTRAINT_NAME | CHECK_CLAUSE |
|---|---|---|
| activity_logs | 2200_18385_11_not_null | created_at IS NOT NULL |
| activity_logs | 2200_18385_1_not_null | id IS NOT NULL |
| activity_logs | 2200_18385_2_not_null | tenant_id IS NOT NULL |
| activity_logs | 2200_18385_3_not_null | entity_type IS NOT NULL |
| activity_logs | 2200_18385_4_not_null | entity_id IS NOT NULL |
| activity_logs | 2200_18385_5_not_null | action IS NOT NULL |
| activity_logs | 2200_18385_6_not_null | description IS NOT NULL |
| activity_logs | 2200_18385_7_not_null | metadata IS NOT NULL |
| activity_logs | 2200_18385_8_not_null | user_id IS NOT NULL |
| ai_jobs | 2200_18242_10_not_null | cost_usd IS NOT NULL |
| ai_jobs | 2200_18242_13_not_null | metadata IS NOT NULL |
| ai_jobs | 2200_18242_14_not_null | created_at IS NOT NULL |
| ai_jobs | 2200_18242_1_not_null | id IS NOT NULL |
| ai_jobs | 2200_18242_2_not_null | tenant_id IS NOT NULL |
| ai_jobs | 2200_18242_3_not_null | user_id IS NOT NULL |
| ai_jobs | 2200_18242_4_not_null | provider IS NOT NULL |
| ai_jobs | 2200_18242_5_not_null | model IS NOT NULL |
| ai_jobs | 2200_18242_6_not_null | skill IS NOT NULL |
| ai_jobs | 2200_18242_7_not_null | status IS NOT NULL |
| ai_jobs | 2200_18242_8_not_null | input_tokens IS NOT NULL |
| ai_jobs | 2200_18242_9_not_null | output_tokens IS NOT NULL |
| ai_usage_logs | 2200_18939_10_not_null | outcome IS NOT NULL |
| ai_usage_logs | 2200_18939_12_not_null | created_at IS NOT NULL |
| ai_usage_logs | 2200_18939_1_not_null | id IS NOT NULL |
| ai_usage_logs | 2200_18939_2_not_null | tenant_id IS NOT NULL |
| ai_usage_logs | 2200_18939_4_not_null | model IS NOT NULL |
| ai_usage_logs | 2200_18939_5_not_null | feature IS NOT NULL |
| ai_usage_logs | 2200_18939_6_not_null | tokens_input IS NOT NULL |
| ai_usage_logs | 2200_18939_7_not_null | tokens_output IS NOT NULL |
| ai_usage_logs | 2200_18939_8_not_null | cost_usd IS NOT NULL |
| artist_goals | 2200_18258_12_not_null | metadata IS NOT NULL |
| artist_goals | 2200_18258_13_not_null | created_at IS NOT NULL |
| artist_goals | 2200_18258_14_not_null | updated_at IS NOT NULL |
| artist_goals | 2200_18258_1_not_null | id IS NOT NULL |
| artist_goals | 2200_18258_2_not_null | tenant_id IS NOT NULL |
| artist_goals | 2200_18258_3_not_null | artista_id IS NOT NULL |
| artist_goals | 2200_18258_4_not_null | titulo IS NOT NULL |
| artist_goals | 2200_18258_5_not_null | tipo IS NOT NULL |
| artist_goals | 2200_18258_7_not_null | valor_atual IS NOT NULL |
| artist_goals | 2200_18258_8_not_null | status IS NOT NULL |
| artist_goals | 2200_18258_9_not_null | periodo IS NOT NULL |
| artist_platform_profiles | 2200_20579_19_not_null | raw_payload IS NOT NULL |
| artist_platform_profiles | 2200_20579_1_not_null | id IS NOT NULL |
| artist_platform_profiles | 2200_20579_20_not_null | sync_status IS NOT NULL |
| artist_platform_profiles | 2200_20579_23_not_null | created_at IS NOT NULL |
| artist_platform_profiles | 2200_20579_24_not_null | updated_at IS NOT NULL |
| artist_platform_profiles | 2200_20579_2_not_null | tenant_id IS NOT NULL |
| artist_platform_profiles | 2200_20579_3_not_null | artist_id IS NOT NULL |
| artist_platform_profiles | 2200_20579_4_not_null | platform IS NOT NULL |
| artists | 2200_22184_1_not_null | id IS NOT NULL |
| artists | 2200_22184_2_not_null | tenant_id IS NOT NULL |
| artists | 2200_22184_38_not_null | tipo IS NOT NULL |
| artists | 2200_22184_39_not_null | status IS NOT NULL |
| artists | 2200_22184_40_not_null | status_cadastro IS NOT NULL |
| artists | 2200_22184_4_not_null | nome_artistico IS NOT NULL |
| artists | 2200_22184_6_not_null | especialidades IS NOT NULL |
| artists | 2200_22184_71_not_null | galeria_urls IS NOT NULL |
| artists | 2200_22184_72_not_null | documentos IS NOT NULL |
| artists | 2200_22184_73_not_null | metadata IS NOT NULL |
| artists | 2200_22184_74_not_null | created_at IS NOT NULL |
| artists | 2200_22184_75_not_null | updated_at IS NOT NULL |
| asset_usage_logs | 2200_20247_1_not_null | id IS NOT NULL |
| asset_usage_logs | 2200_20247_2_not_null | tenant_id IS NOT NULL |
| asset_usage_logs | 2200_20247_3_not_null | asset_id IS NOT NULL |
| asset_usage_logs | 2200_20247_4_not_null | action IS NOT NULL |
| asset_usage_logs | 2200_20247_8_not_null | metadata IS NOT NULL |
| asset_usage_logs | 2200_20247_9_not_null | created_at IS NOT NULL |
| asset_versions | 2200_20213_11_not_null | created_at IS NOT NULL |
| asset_versions | 2200_20213_1_not_null | id IS NOT NULL |
| asset_versions | 2200_20213_2_not_null | tenant_id IS NOT NULL |
| asset_versions | 2200_20213_3_not_null | asset_id IS NOT NULL |
| asset_versions | 2200_20213_4_not_null | version IS NOT NULL |
| asset_versions | 2200_20213_5_not_null | file_url IS NOT NULL |
| assets | 2200_20196_10_not_null | metadata IS NOT NULL |
| assets | 2200_20196_12_not_null | created_at IS NOT NULL |
| assets | 2200_20196_13_not_null | updated_at IS NOT NULL |
| assets | 2200_20196_1_not_null | id IS NOT NULL |
| assets | 2200_20196_2_not_null | tenant_id IS NOT NULL |
| assets | 2200_20196_3_not_null | name IS NOT NULL |
| assets | 2200_20196_4_not_null | asset_type IS NOT NULL |
| assets | 2200_20196_6_not_null | status IS NOT NULL |
| assets | 2200_20196_7_not_null | source IS NOT NULL |
| audiovisual_approvals | 2200_19322_10_not_null | revision_round IS NOT NULL |
| audiovisual_approvals | 2200_19322_11_not_null | requested_at IS NOT NULL |
| audiovisual_approvals | 2200_19322_14_not_null | metadata IS NOT NULL |
| audiovisual_approvals | 2200_19322_15_not_null | created_at IS NOT NULL |
| audiovisual_approvals | 2200_19322_16_not_null | updated_at IS NOT NULL |
| audiovisual_approvals | 2200_19322_1_not_null | id IS NOT NULL |
| audiovisual_approvals | 2200_19322_2_not_null | tenant_id IS NOT NULL |
| audiovisual_approvals | 2200_19322_3_not_null | audiovisual_project_id IS NOT NULL |
| audiovisual_approvals | 2200_19322_8_not_null | status IS NOT NULL |
| audiovisual_approvals | chk_av_approvals_status | ((status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying, 'revision_requested'::character varying])::text[])) |
| audiovisual_assets | 2200_19360_11_not_null | tags IS NOT NULL |
| audiovisual_assets | 2200_19360_12_not_null | metadata IS NOT NULL |
| audiovisual_assets | 2200_19360_14_not_null | created_at IS NOT NULL |
| audiovisual_assets | 2200_19360_15_not_null | updated_at IS NOT NULL |
| audiovisual_assets | 2200_19360_1_not_null | id IS NOT NULL |
| audiovisual_assets | 2200_19360_2_not_null | tenant_id IS NOT NULL |
| audiovisual_assets | 2200_19360_3_not_null | audiovisual_project_id IS NOT NULL |
| audiovisual_assets | 2200_19360_4_not_null | name IS NOT NULL |
| audiovisual_assets | 2200_19360_5_not_null | kind IS NOT NULL |
| audiovisual_assets | 2200_19360_6_not_null | file_url IS NOT NULL |
| audiovisual_assets | chk_av_assets_kind | ((kind)::text = ANY ((ARRAY['reference'::character varying, 'bts'::character varying, 'inspiration'::character varying, 'moodboard'::character varying, 'location_photo'::character varying, 'document'::character varying, 'raw_footage'::character varying, 'other'::character varying])::text[])) |
| audiovisual_briefings | 2200_19232_10_not_null | aspect_ratios IS NOT NULL |
| audiovisual_briefings | 2200_19232_11_not_null | color_palette IS NOT NULL |
| audiovisual_briefings | 2200_19232_12_not_null | moodboard_links IS NOT NULL |
| audiovisual_briefings | 2200_19232_18_not_null | metadata IS NOT NULL |
| audiovisual_briefings | 2200_19232_1_not_null | id IS NOT NULL |
| audiovisual_briefings | 2200_19232_21_not_null | created_at IS NOT NULL |
| audiovisual_briefings | 2200_19232_22_not_null | updated_at IS NOT NULL |
| audiovisual_briefings | 2200_19232_2_not_null | tenant_id IS NOT NULL |
| audiovisual_briefings | 2200_19232_3_not_null | audiovisual_project_id IS NOT NULL |
| audiovisual_briefings | 2200_19232_6_not_null | references_list IS NOT NULL |
| audiovisual_briefings | 2200_19232_8_not_null | platforms IS NOT NULL |
| audiovisual_deliverables | 2200_19301_10_not_null | version IS NOT NULL |
| audiovisual_deliverables | 2200_19301_11_not_null | status IS NOT NULL |
| audiovisual_deliverables | 2200_19301_12_not_null | approved IS NOT NULL |
| audiovisual_deliverables | 2200_19301_13_not_null | published IS NOT NULL |
| audiovisual_deliverables | 2200_19301_18_not_null | metadata IS NOT NULL |
| audiovisual_deliverables | 2200_19301_19_not_null | created_at IS NOT NULL |
| audiovisual_deliverables | 2200_19301_1_not_null | id IS NOT NULL |
| audiovisual_deliverables | 2200_19301_20_not_null | updated_at IS NOT NULL |
| audiovisual_deliverables | 2200_19301_2_not_null | tenant_id IS NOT NULL |
| audiovisual_deliverables | 2200_19301_3_not_null | audiovisual_project_id IS NOT NULL |
| audiovisual_deliverables | 2200_19301_4_not_null | title IS NOT NULL |
| audiovisual_deliverables | 2200_19301_5_not_null | type IS NOT NULL |
| audiovisual_deliverables | chk_av_deliverables_type | ((type)::text = ANY ((ARRAY['youtube_master'::character varying, 'vertical_reels'::character varying, 'tiktok_cut'::character varying, 'teaser'::character varying, 'thumbnail'::character varying, 'subtitles'::character varying, 'backstage_cut'::character varying, 'trailer'::character varying, 'stories'::character varying, 'ads'::character varying, 'short_clip'::character varying, 'other'::character varying])::text[])) |
| audiovisual_production_days | 2200_19271_11_not_null | status IS NOT NULL |
| audiovisual_production_days | 2200_19271_12_not_null | metadata IS NOT NULL |
| audiovisual_production_days | 2200_19271_13_not_null | created_at IS NOT NULL |
| audiovisual_production_days | 2200_19271_14_not_null | updated_at IS NOT NULL |
| audiovisual_production_days | 2200_19271_1_not_null | id IS NOT NULL |
| audiovisual_production_days | 2200_19271_2_not_null | tenant_id IS NOT NULL |
| audiovisual_production_days | 2200_19271_3_not_null | audiovisual_project_id IS NOT NULL |
| audiovisual_production_days | 2200_19271_4_not_null | shooting_date IS NOT NULL |
| audiovisual_projects | 2200_22499_1_not_null | id IS NOT NULL |
| audiovisual_projects | 2200_22499_23_not_null | status IS NOT NULL |
| audiovisual_projects | 2200_22499_2_not_null | tenant_id IS NOT NULL |
| audiovisual_projects | 2200_22499_35_not_null | priority IS NOT NULL |
| audiovisual_projects | 2200_22499_42_not_null | metadata IS NOT NULL |
| audiovisual_projects | 2200_22499_43_not_null | created_at IS NOT NULL |
| audiovisual_projects | 2200_22499_44_not_null | updated_at IS NOT NULL |
| audiovisual_projects | 2200_22499_5_not_null | title IS NOT NULL |
| audiovisual_projects | 2200_22499_7_not_null | type IS NOT NULL |
| audiovisual_projects | chk_av_projects_status | ((status)::text = ANY (ARRAY[('draft'::character varying)::text, ('briefing'::character varying)::text, ('pre_production'::character varying)::text, ('production'::character varying)::text, ('post_production'::character varying)::text, ('approval'::character varying)::text, ('delivered'::character varying)::text, ('published'::character varying)::text, ('cancelled'::character varying)::text])) |
| audiovisual_projects | chk_av_projects_type | ((type)::text = ANY (ARRAY[('music_video'::character varying)::text, ('visualizer'::character varying)::text, ('lyric_video'::character varying)::text, ('teaser'::character varying)::text, ('reels'::character varying)::text, ('backstage'::character varying)::text, ('documentary'::character varying)::text, ('live_session'::character varying)::text, ('aftermovie'::character varying)::text, ('promo'::character varying)::text, ('commercial'::character varying)::text, ('social_content'::character varying)::text, ('other'::character varying)::text])) |
| audiovisual_shots | 2200_19252_10_not_null | wardrobe IS NOT NULL |
| audiovisual_shots | 2200_19252_11_not_null | equipment IS NOT NULL |
| audiovisual_shots | 2200_19252_14_not_null | shooting_status IS NOT NULL |
| audiovisual_shots | 2200_19252_15_not_null | metadata IS NOT NULL |
| audiovisual_shots | 2200_19252_16_not_null | created_at IS NOT NULL |
| audiovisual_shots | 2200_19252_17_not_null | updated_at IS NOT NULL |
| audiovisual_shots | 2200_19252_1_not_null | id IS NOT NULL |
| audiovisual_shots | 2200_19252_2_not_null | tenant_id IS NOT NULL |
| audiovisual_shots | 2200_19252_3_not_null | audiovisual_project_id IS NOT NULL |
| audiovisual_shots | 2200_19252_4_not_null | ordering IS NOT NULL |
| audiovisual_shots | 2200_19252_8_not_null | actors IS NOT NULL |
| audiovisual_shots | 2200_19252_9_not_null | props IS NOT NULL |
| audiovisual_tasks | 2200_19339_11_not_null | auto_generated IS NOT NULL |
| audiovisual_tasks | 2200_19339_13_not_null | metadata IS NOT NULL |
| audiovisual_tasks | 2200_19339_16_not_null | created_at IS NOT NULL |
| audiovisual_tasks | 2200_19339_17_not_null | updated_at IS NOT NULL |
| audiovisual_tasks | 2200_19339_1_not_null | id IS NOT NULL |
| audiovisual_tasks | 2200_19339_2_not_null | tenant_id IS NOT NULL |
| audiovisual_tasks | 2200_19339_3_not_null | audiovisual_project_id IS NOT NULL |
| audiovisual_tasks | 2200_19339_4_not_null | title IS NOT NULL |
| audiovisual_tasks | 2200_19339_6_not_null | status IS NOT NULL |
| audiovisual_tasks | 2200_19339_7_not_null | priority IS NOT NULL |
| audiovisual_tasks | chk_av_tasks_priority | ((priority)::text = ANY ((ARRAY['low'::character varying, 'medium'::character varying, 'high'::character varying, 'urgent'::character varying])::text[])) |
| audiovisual_tasks | chk_av_tasks_status | ((status)::text = ANY ((ARRAY['pending'::character varying, 'in_progress'::character varying, 'blocked'::character varying, 'done'::character varying, 'cancelled'::character varying])::text[])) |
| audiovisual_team_members | 2200_19285_11_not_null | metadata IS NOT NULL |
| audiovisual_team_members | 2200_19285_12_not_null | created_at IS NOT NULL |
| audiovisual_team_members | 2200_19285_13_not_null | updated_at IS NOT NULL |
| audiovisual_team_members | 2200_19285_1_not_null | id IS NOT NULL |
| audiovisual_team_members | 2200_19285_2_not_null | tenant_id IS NOT NULL |
| audiovisual_team_members | 2200_19285_3_not_null | audiovisual_project_id IS NOT NULL |
| audiovisual_team_members | 2200_19285_6_not_null | role IS NOT NULL |
| audiovisual_team_members | 2200_19285_9_not_null | payment_status IS NOT NULL |
| audit_logs | 2200_18228_12_not_null | metadata IS NOT NULL |
| audit_logs | 2200_18228_13_not_null | created_at IS NOT NULL |
| audit_logs | 2200_18228_1_not_null | id IS NOT NULL |
| audit_logs | 2200_18228_4_not_null | action IS NOT NULL |
| audit_logs | 2200_18228_5_not_null | entity IS NOT NULL |
| billing_plans | 2200_21489_10_not_null | limits IS NOT NULL |
| billing_plans | 2200_21489_13_not_null | created_at IS NOT NULL |
| billing_plans | 2200_21489_14_not_null | updated_at IS NOT NULL |
| billing_plans | 2200_21489_1_not_null | id IS NOT NULL |
| billing_plans | 2200_21489_2_not_null | slug IS NOT NULL |
| billing_plans | 2200_21489_3_not_null | name IS NOT NULL |
| billing_plans | 2200_21489_5_not_null | amount IS NOT NULL |
| billing_plans | 2200_21489_6_not_null | currency IS NOT NULL |
| billing_plans | 2200_21489_7_not_null | interval IS NOT NULL |
| billing_plans | 2200_21489_8_not_null | active IS NOT NULL |
| billing_plans | 2200_21489_9_not_null | features IS NOT NULL |
| billing_plans | chk_billing_plans_amount | (amount > 0) |
| billing_plans | chk_billing_plans_currency_lower | ((currency)::text = lower((currency)::text)) |
| billing_plans | chk_billing_plans_interval | (("interval")::text = ANY ((ARRAY['month'::character varying, 'year'::character varying])::text[])) |
| billing_settings | 2200_21477_1_not_null | id IS NOT NULL |
| billing_settings | 2200_21477_2_not_null | key IS NOT NULL |
| billing_settings | 2200_21477_3_not_null | value IS NOT NULL |
| billing_settings | 2200_21477_4_not_null | created_at IS NOT NULL |
| billing_settings | 2200_21477_5_not_null | updated_at IS NOT NULL |
| billing_subscriptions | 2200_17863_10_not_null | seats_used IS NOT NULL |
| billing_subscriptions | 2200_17863_11_not_null | metadata IS NOT NULL |
| billing_subscriptions | 2200_17863_12_not_null | created_at IS NOT NULL |
| billing_subscriptions | 2200_17863_13_not_null | updated_at IS NOT NULL |
| billing_subscriptions | 2200_17863_18_not_null | cancel_at_period_end IS NOT NULL |
| billing_subscriptions | 2200_17863_1_not_null | id IS NOT NULL |
| billing_subscriptions | 2200_17863_2_not_null | org_id IS NOT NULL |
| billing_subscriptions | 2200_17863_5_not_null | plan IS NOT NULL |
| billing_subscriptions | 2200_17863_6_not_null | status IS NOT NULL |
| billing_subscriptions | 2200_17863_9_not_null | seats IS NOT NULL |
| billing_subscriptions | chk_billing_subscriptions_status | ((status)::text = ANY ((ARRAY['trialing'::character varying, 'trial'::character varying, 'active'::character varying, 'past_due'::character varying, 'unpaid'::character varying, 'cancelled'::character varying, 'canceled'::character varying, 'incomplete'::character varying, 'incomplete_expired'::character varying])::text[])) |
| briefings | 2200_18051_10_not_null | created_at IS NOT NULL |
| briefings | 2200_18051_11_not_null | updated_at IS NOT NULL |
| briefings | 2200_18051_1_not_null | id IS NOT NULL |
| briefings | 2200_18051_2_not_null | tenant_id IS NOT NULL |
| briefings | 2200_18051_3_not_null | titulo IS NOT NULL |
| briefings | 2200_18051_7_not_null | status IS NOT NULL |
| briefings | 2200_18051_9_not_null | metadata IS NOT NULL |
| budget_revisions | 2200_21941_1_not_null | id IS NOT NULL |
| budget_revisions | 2200_21941_2_not_null | tenant_id IS NOT NULL |
| budget_revisions | 2200_21941_3_not_null | budget_id IS NOT NULL |
| budget_revisions | 2200_21941_4_not_null | previous_amount IS NOT NULL |
| budget_revisions | 2200_21941_5_not_null | new_amount IS NOT NULL |
| budget_revisions | 2200_21941_6_not_null | reason IS NOT NULL |
| budget_revisions | 2200_21941_8_not_null | created_at IS NOT NULL |
| budget_revisions | budget_revisions_new_amount_check | (new_amount >= (0)::numeric) |
| budgets | 2200_21918_10_not_null | updated_at IS NOT NULL |
| budgets | 2200_21918_1_not_null | id IS NOT NULL |
| budgets | 2200_21918_2_not_null | tenant_id IS NOT NULL |
| budgets | 2200_21918_3_not_null | project_id IS NOT NULL |
| budgets | 2200_21918_4_not_null | amount IS NOT NULL |
| budgets | 2200_21918_5_not_null | currency IS NOT NULL |
| budgets | 2200_21918_7_not_null | is_active IS NOT NULL |
| budgets | 2200_21918_8_not_null | version IS NOT NULL |
| budgets | 2200_21918_9_not_null | created_at IS NOT NULL |
| budgets | budgets_amount_check | (amount >= (0)::numeric) |
| budgets | budgets_currency_check | (currency ~ '^[A-Z]{3}$'::text) |
| campaign_assets | 2200_22989_1_not_null | id IS NOT NULL |
| campaign_assets | 2200_22989_2_not_null | tenant_id IS NOT NULL |
| campaign_assets | 2200_22989_3_not_null | campaign_id IS NOT NULL |
| campaign_assets | 2200_22989_4_not_null | name IS NOT NULL |
| campaign_assets | 2200_22989_5_not_null | asset_type IS NOT NULL |
| campaign_assets | 2200_22989_6_not_null | file_url IS NOT NULL |
| campaign_assets | 2200_22989_8_not_null | metadata IS NOT NULL |
| campaign_assets | 2200_22989_9_not_null | created_at IS NOT NULL |
| campaign_tasks | 2200_22959_11_not_null | created_at IS NOT NULL |
| campaign_tasks | 2200_22959_12_not_null | updated_at IS NOT NULL |
| campaign_tasks | 2200_22959_1_not_null | id IS NOT NULL |
| campaign_tasks | 2200_22959_2_not_null | tenant_id IS NOT NULL |
| campaign_tasks | 2200_22959_3_not_null | campaign_id IS NOT NULL |
| campaign_tasks | 2200_22959_4_not_null | title IS NOT NULL |
| campaign_tasks | 2200_22959_6_not_null | status IS NOT NULL |
| campaign_tasks | 2200_22959_7_not_null | priority IS NOT NULL |
| campaigns | 2200_23015_11_not_null | metadata IS NOT NULL |
| campaigns | 2200_23015_12_not_null | created_at IS NOT NULL |
| campaigns | 2200_23015_13_not_null | updated_at IS NOT NULL |
| campaigns | 2200_23015_1_not_null | id IS NOT NULL |
| campaigns | 2200_23015_2_not_null | tenant_id IS NOT NULL |
| campaigns | 2200_23015_3_not_null | nome IS NOT NULL |
| campaigns | 2200_23015_4_not_null | tipo IS NOT NULL |
| campaigns | 2200_23015_5_not_null | status IS NOT NULL |
| client_attachments | 2200_23354_10_not_null | created_at IS NOT NULL |
| client_attachments | 2200_23354_1_not_null | id IS NOT NULL |
| client_attachments | 2200_23354_2_not_null | tenant_id IS NOT NULL |
| client_attachments | 2200_23354_3_not_null | client_id IS NOT NULL |
| client_attachments | 2200_23354_4_not_null | storage_key IS NOT NULL |
| client_attachments | 2200_23354_5_not_null | filename IS NOT NULL |
| client_attachments | 2200_23354_6_not_null | mime_type IS NOT NULL |
| client_attachments | 2200_23354_7_not_null | size_bytes IS NOT NULL |
| clients | 2200_22633_1_not_null | id IS NOT NULL |
| clients | 2200_22633_2_not_null | tenant_id IS NOT NULL |
| clients | 2200_22633_33_not_null | status IS NOT NULL |
| clients | 2200_22633_34_not_null | metadata IS NOT NULL |
| clients | 2200_22633_35_not_null | created_at IS NOT NULL |
| clients | 2200_22633_36_not_null | updated_at IS NOT NULL |
| clients | 2200_22633_3_not_null | tipo_pessoa IS NOT NULL |
| clients | 2200_22633_4_not_null | categoria IS NOT NULL |
| clients | 2200_22633_5_not_null | perfil IS NOT NULL |
| clients | 2200_22633_6_not_null | nome IS NOT NULL |
| content_detections | 2200_18274_10_not_null | tipo IS NOT NULL |
| content_detections | 2200_18274_11_not_null | detectado_em IS NOT NULL |
| content_detections | 2200_18274_12_not_null | metadata IS NOT NULL |
| content_detections | 2200_18274_13_not_null | created_at IS NOT NULL |
| content_detections | 2200_18274_14_not_null | updated_at IS NOT NULL |
| content_detections | 2200_18274_1_not_null | id IS NOT NULL |
| content_detections | 2200_18274_2_not_null | tenant_id IS NOT NULL |
| content_detections | 2200_18274_5_not_null | plataforma IS NOT NULL |
| content_detections | 2200_18274_9_not_null | status IS NOT NULL |
| contract_service_types | 2200_23382_10_not_null | requires_fixed_value IS NOT NULL |
| contract_service_types | 2200_23382_11_not_null | requires_advance IS NOT NULL |
| contract_service_types | 2200_23382_12_not_null | requires_financial_support IS NOT NULL |
| contract_service_types | 2200_23382_13_not_null | allow_installments IS NOT NULL |
| contract_service_types | 2200_23382_15_not_null | active IS NOT NULL |
| contract_service_types | 2200_23382_16_not_null | sort_order IS NOT NULL |
| contract_service_types | 2200_23382_19_not_null | conteudo IS NOT NULL |
| contract_service_types | 2200_23382_1_not_null | id IS NOT NULL |
| contract_service_types | 2200_23382_20_not_null | participants IS NOT NULL |
| contract_service_types | 2200_23382_21_not_null | variables IS NOT NULL |
| contract_service_types | 2200_23382_25_not_null | financial_currency IS NOT NULL |
| contract_service_types | 2200_23382_26_not_null | financial_payment_frequency IS NOT NULL |
| contract_service_types | 2200_23382_2_not_null | tenant_id IS NOT NULL |
| contract_service_types | 2200_23382_31_not_null | created_at IS NOT NULL |
| contract_service_types | 2200_23382_32_not_null | updated_at IS NOT NULL |
| contract_service_types | 2200_23382_3_not_null | name IS NOT NULL |
| contract_service_types | 2200_23382_4_not_null | slug IS NOT NULL |
| contract_service_types | 2200_23382_7_not_null | client_types IS NOT NULL |
| contract_service_types | 2200_23382_8_not_null | financial_model IS NOT NULL |
| contract_service_types | 2200_23382_9_not_null | requires_external_rights_terms IS NOT NULL |
| contract_templates | 2200_17953_1_not_null | id IS NOT NULL |
| contract_templates | 2200_17953_2_not_null | tenant_id IS NOT NULL |
| contract_templates | 2200_17953_3_not_null | titulo IS NOT NULL |
| contract_templates | 2200_17953_4_not_null | tipo IS NOT NULL |
| contract_templates | 2200_17953_5_not_null | conteudo IS NOT NULL |
| contract_templates | 2200_17953_6_not_null | variaveis IS NOT NULL |
| contract_templates | 2200_17953_7_not_null | ativo IS NOT NULL |
| contract_templates | 2200_17953_8_not_null | created_at IS NOT NULL |
| contract_templates | 2200_17953_9_not_null | updated_at IS NOT NULL |
| contracts | 2200_22714_13_not_null | exclusivo IS NOT NULL |
| contracts | 2200_22714_18_not_null | versoes IS NOT NULL |
| contracts | 2200_22714_1_not_null | id IS NOT NULL |
| contracts | 2200_22714_20_not_null | metadata IS NOT NULL |
| contracts | 2200_22714_21_not_null | created_at IS NOT NULL |
| contracts | 2200_22714_22_not_null | updated_at IS NOT NULL |
| contracts | 2200_22714_2_not_null | tenant_id IS NOT NULL |
| contracts | 2200_22714_4_not_null | titulo IS NOT NULL |
| contracts | 2200_22714_5_not_null | tipo IS NOT NULL |
| contracts | 2200_22714_6_not_null | status IS NOT NULL |
| conversation_messages | 2200_18638_1_not_null | id IS NOT NULL |
| conversation_messages | 2200_18638_2_not_null | conversation_id IS NOT NULL |
| conversation_messages | 2200_18638_3_not_null | tenant_id IS NOT NULL |
| conversation_messages | 2200_18638_4_not_null | body IS NOT NULL |
| conversation_messages | 2200_18638_5_not_null | sender_id IS NOT NULL |
| conversation_messages | 2200_18638_6_not_null | sender_type IS NOT NULL |
| conversation_messages | 2200_18638_7_not_null | attachments IS NOT NULL |
| conversation_messages | 2200_18638_8_not_null | metadata IS NOT NULL |
| conversation_messages | 2200_18638_9_not_null | created_at IS NOT NULL |
| conversation_notes | 2200_18658_1_not_null | id IS NOT NULL |
| conversation_notes | 2200_18658_2_not_null | conversation_id IS NOT NULL |
| conversation_notes | 2200_18658_3_not_null | tenant_id IS NOT NULL |
| conversation_notes | 2200_18658_4_not_null | body IS NOT NULL |
| conversation_notes | 2200_18658_5_not_null | author_id IS NOT NULL |
| conversation_notes | 2200_18658_6_not_null | created_at IS NOT NULL |
| conversation_notes | 2200_18658_7_not_null | updated_at IS NOT NULL |
| conversations | 2200_18611_11_not_null | created_at IS NOT NULL |
| conversations | 2200_18611_12_not_null | updated_at IS NOT NULL |
| conversations | 2200_18611_1_not_null | id IS NOT NULL |
| conversations | 2200_18611_2_not_null | tenant_id IS NOT NULL |
| conversations | 2200_18611_4_not_null | subject IS NOT NULL |
| conversations | 2200_18611_5_not_null | status IS NOT NULL |
| conversations | 2200_18611_6_not_null | channel IS NOT NULL |
| conversations | 2200_18611_9_not_null | metadata IS NOT NULL |
| cost_centers | 2200_21773_1_not_null | id IS NOT NULL |
| cost_centers | 2200_21773_2_not_null | tenant_id IS NOT NULL |
| cost_centers | 2200_21773_3_not_null | name IS NOT NULL |
| cost_centers | 2200_21773_5_not_null | is_active IS NOT NULL |
| cost_centers | 2200_21773_6_not_null | created_at IS NOT NULL |
| cost_centers | 2200_21773_7_not_null | updated_at IS NOT NULL |
| counterparties | 2200_21750_10_not_null | created_at IS NOT NULL |
| counterparties | 2200_21750_11_not_null | updated_at IS NOT NULL |
| counterparties | 2200_21750_1_not_null | id IS NOT NULL |
| counterparties | 2200_21750_2_not_null | tenant_id IS NOT NULL |
| counterparties | 2200_21750_3_not_null | name IS NOT NULL |
| counterparties | 2200_21750_4_not_null | type IS NOT NULL |
| counterparties | 2200_21750_9_not_null | is_active IS NOT NULL |
| counterparties | ck_counterparties_single_ref | (num_nonnulls(artist_id, client_id) <= 1) |
| departments | 2200_20410_10_not_null | updated_at IS NOT NULL |
| departments | 2200_20410_1_not_null | id IS NOT NULL |
| departments | 2200_20410_2_not_null | tenant_id IS NOT NULL |
| departments | 2200_20410_4_not_null | slug IS NOT NULL |
| departments | 2200_20410_5_not_null | name IS NOT NULL |
| departments | 2200_20410_7_not_null | is_active IS NOT NULL |
| departments | 2200_20410_8_not_null | sort_order IS NOT NULL |
| departments | 2200_20410_9_not_null | created_at IS NOT NULL |
| departments | chk_departments_no_self_parent | ((parent_department_id IS NULL) OR (parent_department_id <> id)) |
| domain_event_log | 2200_18365_12_not_null | created_at IS NOT NULL |
| domain_event_log | 2200_18365_1_not_null | id IS NOT NULL |
| domain_event_log | 2200_18365_3_not_null | event_type IS NOT NULL |
| domain_event_log | 2200_18365_8_not_null | payload IS NOT NULL |
| domain_event_log | 2200_18365_9_not_null | occurred_at IS NOT NULL |
| ecad_reports | 2200_18290_10_not_null | metadata IS NOT NULL |
| ecad_reports | 2200_18290_11_not_null | created_at IS NOT NULL |
| ecad_reports | 2200_18290_12_not_null | updated_at IS NOT NULL |
| ecad_reports | 2200_18290_1_not_null | id IS NOT NULL |
| ecad_reports | 2200_18290_2_not_null | tenant_id IS NOT NULL |
| ecad_reports | 2200_18290_4_not_null | periodo IS NOT NULL |
| ecad_reports | 2200_18290_5_not_null | tipo IS NOT NULL |
| ecad_reports | 2200_18290_8_not_null | status IS NOT NULL |
| employees | 2200_22841_14_not_null | tipo_contrato IS NOT NULL |
| employees | 2200_22841_19_not_null | status IS NOT NULL |
| employees | 2200_22841_1_not_null | id IS NOT NULL |
| employees | 2200_22841_22_not_null | documentos IS NOT NULL |
| employees | 2200_22841_23_not_null | metadata IS NOT NULL |
| employees | 2200_22841_24_not_null | created_at IS NOT NULL |
| employees | 2200_22841_25_not_null | updated_at IS NOT NULL |
| employees | 2200_22841_2_not_null | tenant_id IS NOT NULL |
| employees | 2200_22841_4_not_null | nome IS NOT NULL |
| events | 2200_22534_18_not_null | metadata IS NOT NULL |
| events | 2200_22534_19_not_null | created_at IS NOT NULL |
| events | 2200_22534_1_not_null | id IS NOT NULL |
| events | 2200_22534_20_not_null | updated_at IS NOT NULL |
| events | 2200_22534_2_not_null | tenant_id IS NOT NULL |
| events | 2200_22534_3_not_null | titulo IS NOT NULL |
| events | 2200_22534_4_not_null | tipo IS NOT NULL |
| events | 2200_22534_6_not_null | status IS NOT NULL |
| events | 2200_22534_7_not_null | data IS NOT NULL |
| external_identifiers | 2200_19702_10_not_null | created_at IS NOT NULL |
| external_identifiers | 2200_19702_11_not_null | updated_at IS NOT NULL |
| external_identifiers | 2200_19702_1_not_null | id IS NOT NULL |
| external_identifiers | 2200_19702_2_not_null | tenant_id IS NOT NULL |
| external_identifiers | 2200_19702_3_not_null | entity_type IS NOT NULL |
| external_identifiers | 2200_19702_4_not_null | entity_id IS NOT NULL |
| external_identifiers | 2200_19702_5_not_null | provider IS NOT NULL |
| external_identifiers | 2200_19702_6_not_null | identifier_type IS NOT NULL |
| external_identifiers | 2200_19702_7_not_null | identifier_value IS NOT NULL |
| external_identifiers | 2200_19702_8_not_null | is_primary IS NOT NULL |
| external_identifiers | 2200_19702_9_not_null | metadata IS NOT NULL |
| external_identifiers | chk_ext_id_entity_type | ((entity_type)::text = ANY ((ARRAY['WORK'::character varying, 'RECORDING'::character varying, 'RIGHTS_HOLDER'::character varying, 'RELEASE'::character varying, 'SUBMISSION'::character varying])::text[])) |
| external_identifiers | chk_ext_id_provider | ((provider)::text = ANY ((ARRAY['ABRAMUS'::character varying, 'ECAD'::character varying, 'CISAC'::character varying, 'IFPI'::character varying, 'PRO_MUSICA'::character varying, 'ISRC'::character varying, 'INTERNAL'::character varying, 'OTHER'::character varying])::text[])) |
| external_identifiers | chk_ext_id_type | ((identifier_type)::text = ANY ((ARRAY['ISWC'::character varying, 'ISRC'::character varying, 'IPI_CAE'::character varying, 'ECAD_WORK_CODE'::character varying, 'ABRAMUS_PROTOCOL'::character varying, 'SOCIETY_MEMBER_CODE'::character varying, 'CATALOG_NUMBER'::character varying, 'UPC'::character varying, 'EAN'::character varying, 'OTHER'::character varying])::text[])) |
| financial_accounts | 2200_21735_10_not_null | updated_at IS NOT NULL |
| financial_accounts | 2200_21735_1_not_null | id IS NOT NULL |
| financial_accounts | 2200_21735_2_not_null | tenant_id IS NOT NULL |
| financial_accounts | 2200_21735_3_not_null | name IS NOT NULL |
| financial_accounts | 2200_21735_4_not_null | type IS NOT NULL |
| financial_accounts | 2200_21735_5_not_null | currency IS NOT NULL |
| financial_accounts | 2200_21735_8_not_null | is_active IS NOT NULL |
| financial_accounts | 2200_21735_9_not_null | created_at IS NOT NULL |
| financial_accounts | ck_financial_accounts_opening_pair | ((opening_balance IS NULL) = (opening_balance_date IS NULL)) |
| financial_accounts | financial_accounts_currency_check | (currency ~ '^[A-Z]{3}$'::text) |
| financial_categories | 2200_21705_10_not_null | sort_order IS NOT NULL |
| financial_categories | 2200_21705_11_not_null | created_at IS NOT NULL |
| financial_categories | 2200_21705_12_not_null | updated_at IS NOT NULL |
| financial_categories | 2200_21705_1_not_null | id IS NOT NULL |
| financial_categories | 2200_21705_2_not_null | tenant_id IS NOT NULL |
| financial_categories | 2200_21705_5_not_null | name IS NOT NULL |
| financial_categories | 2200_21705_6_not_null | nature IS NOT NULL |
| financial_categories | 2200_21705_7_not_null | includes_in_pnl IS NOT NULL |
| financial_categories | 2200_21705_8_not_null | level IS NOT NULL |
| financial_categories | 2200_21705_9_not_null | is_active IS NOT NULL |
| financial_categories | financial_categories_level_check | ((level >= 1) AND (level <= 3)) |
| financial_category_audit_logs | 2200_19128_10_not_null | metadata IS NOT NULL |
| financial_category_audit_logs | 2200_19128_11_not_null | timestamp IS NOT NULL |
| financial_category_audit_logs | 2200_19128_1_not_null | id IS NOT NULL |
| financial_category_audit_logs | 2200_19128_2_not_null | tenant_id IS NOT NULL |
| financial_category_audit_logs | 2200_19128_4_not_null | action IS NOT NULL |
| financial_category_audit_logs | 2200_19128_6_not_null | actor_type IS NOT NULL |
| financial_category_audit_logs | 2200_19128_7_not_null | before IS NOT NULL |
| financial_category_audit_logs | 2200_19128_8_not_null | after IS NOT NULL |
| financial_category_templates | 2200_21689_1_not_null | id IS NOT NULL |
| financial_category_templates | 2200_21689_3_not_null | name IS NOT NULL |
| financial_category_templates | 2200_21689_4_not_null | nature IS NOT NULL |
| financial_category_templates | 2200_21689_5_not_null | includes_in_pnl IS NOT NULL |
| financial_category_templates | 2200_21689_6_not_null | level IS NOT NULL |
| financial_category_templates | 2200_21689_7_not_null | sort_order IS NOT NULL |
| financial_category_templates | financial_category_templates_level_check | ((level >= 1) AND (level <= 3)) |
| financial_rules | 2200_18988_10_not_null | condicoes IS NOT NULL |
| financial_rules | 2200_18988_13_not_null | created_at IS NOT NULL |
| financial_rules | 2200_18988_14_not_null | updated_at IS NOT NULL |
| financial_rules | 2200_18988_1_not_null | id IS NOT NULL |
| financial_rules | 2200_18988_2_not_null | tenant_id IS NOT NULL |
| financial_rules | 2200_18988_3_not_null | nome IS NOT NULL |
| financial_rules | 2200_18988_4_not_null | tipo IS NOT NULL |
| financial_rules | 2200_18988_6_not_null | calculo IS NOT NULL |
| financial_rules | 2200_18988_7_not_null | valor IS NOT NULL |
| financial_rules | 2200_18988_9_not_null | ativo IS NOT NULL |
| financial_transactions | 2200_21785_10_not_null | competence_date IS NOT NULL |
| financial_transactions | 2200_21785_1_not_null | id IS NOT NULL |
| financial_transactions | 2200_21785_2_not_null | tenant_id IS NOT NULL |
| financial_transactions | 2200_21785_33_not_null | metadata IS NOT NULL |
| financial_transactions | 2200_21785_34_not_null | version IS NOT NULL |
| financial_transactions | 2200_21785_35_not_null | created_at IS NOT NULL |
| financial_transactions | 2200_21785_36_not_null | updated_at IS NOT NULL |
| financial_transactions | 2200_21785_3_not_null | type IS NOT NULL |
| financial_transactions | 2200_21785_4_not_null | status IS NOT NULL |
| financial_transactions | 2200_21785_6_not_null | amount IS NOT NULL |
| financial_transactions | 2200_21785_7_not_null | currency IS NOT NULL |
| financial_transactions | 2200_21785_9_not_null | category_snapshot IS NOT NULL |
| financial_transactions | ck_fintx_amount_positive | (amount > (0)::numeric) |
| financial_transactions | ck_fintx_category_required | ((type = 'transfer'::transaction_type) OR (category_id IS NOT NULL)) |
| financial_transactions | ck_fintx_installments_triplet | (((installment_group_id IS NULL) AND (installment_number IS NULL) AND (installment_count IS NULL) AND (installment_interval IS NULL)) OR ((installment_group_id IS NOT NULL) AND (installment_number IS NOT NULL) AND (installment_count IS NOT NULL) AND (installment_interval IS NOT NULL) AND ((installment_number >= 1) AND (installment_number <= installment_count)))) |
| financial_transactions | ck_fintx_no_self_reversal | (reversal_of_id <> id) |
| financial_transactions | ck_fintx_settlement_status | (((status = 'settled'::transaction_status) AND (settlement_date IS NOT NULL)) OR ((status = 'pending'::transaction_status) AND (settlement_date IS NULL)) OR ((status = 'cancelled'::transaction_status) AND (settlement_date IS NULL)) OR (status = 'reversed'::transaction_status)) |
| financial_transactions | ck_fintx_transfer_accounts | (((type = 'transfer'::transaction_type) AND (account_id IS NOT NULL) AND (counter_account_id IS NOT NULL) AND (account_id <> counter_account_id)) OR ((type <> 'transfer'::transaction_type) AND (counter_account_id IS NULL))) |
| financial_transactions | financial_transactions_currency_check | (currency ~ '^[A-Z]{3}$'::text) |
| form_submissions | 2200_18695_1_not_null | id IS NOT NULL |
| form_submissions | 2200_18695_2_not_null | form_id IS NOT NULL |
| form_submissions | 2200_18695_3_not_null | tenant_id IS NOT NULL |
| form_submissions | 2200_18695_5_not_null | data IS NOT NULL |
| form_submissions | 2200_18695_8_not_null | metadata IS NOT NULL |
| form_submissions | 2200_18695_9_not_null | created_at IS NOT NULL |
| forms | 2200_18675_10_not_null | created_at IS NOT NULL |
| forms | 2200_18675_11_not_null | updated_at IS NOT NULL |
| forms | 2200_18675_1_not_null | id IS NOT NULL |
| forms | 2200_18675_2_not_null | tenant_id IS NOT NULL |
| forms | 2200_18675_3_not_null | name IS NOT NULL |
| forms | 2200_18675_5_not_null | fields IS NOT NULL |
| forms | 2200_18675_6_not_null | settings IS NOT NULL |
| forms | 2200_18675_7_not_null | status IS NOT NULL |
| forms | 2200_18675_8_not_null | submission_count IS NOT NULL |
| integrations | 2200_18182_10_not_null | created_at IS NOT NULL |
| integrations | 2200_18182_11_not_null | updated_at IS NOT NULL |
| integrations | 2200_18182_1_not_null | id IS NOT NULL |
| integrations | 2200_18182_2_not_null | tenant_id IS NOT NULL |
| integrations | 2200_18182_3_not_null | provider IS NOT NULL |
| integrations | 2200_18182_4_not_null | status IS NOT NULL |
| integrations | 2200_18182_6_not_null | settings IS NOT NULL |
| integrations | 2200_18182_8_not_null | failure_count IS NOT NULL |
| integrations | 2200_18182_9_not_null | metadata IS NOT NULL |
| inventory_items | 2200_22824_15_not_null | created_at IS NOT NULL |
| inventory_items | 2200_22824_16_not_null | updated_at IS NOT NULL |
| inventory_items | 2200_22824_1_not_null | id IS NOT NULL |
| inventory_items | 2200_22824_2_not_null | tenant_id IS NOT NULL |
| inventory_items | 2200_22824_3_not_null | nome IS NOT NULL |
| inventory_items | 2200_22824_5_not_null | quantidade IS NOT NULL |
| inventory_items | 2200_22824_8_not_null | status IS NOT NULL |
| invoices | 2200_17981_14_not_null | metadata IS NOT NULL |
| invoices | 2200_17981_15_not_null | created_at IS NOT NULL |
| invoices | 2200_17981_16_not_null | updated_at IS NOT NULL |
| invoices | 2200_17981_1_not_null | id IS NOT NULL |
| invoices | 2200_17981_26_not_null | attempt_count IS NOT NULL |
| invoices | 2200_17981_2_not_null | tenant_id IS NOT NULL |
| invoices | 2200_17981_4_not_null | tipo IS NOT NULL |
| invoices | 2200_17981_5_not_null | status IS NOT NULL |
| invoices | 2200_17981_9_not_null | valor IS NOT NULL |
| job_functions | 2200_20461_1_not_null | id IS NOT NULL |
| job_functions | 2200_20461_2_not_null | tenant_id IS NOT NULL |
| job_functions | 2200_20461_3_not_null | slug IS NOT NULL |
| job_functions | 2200_20461_4_not_null | name IS NOT NULL |
| job_functions | 2200_20461_7_not_null | is_active IS NOT NULL |
| job_functions | 2200_20461_8_not_null | created_at IS NOT NULL |
| job_functions | 2200_20461_9_not_null | updated_at IS NOT NULL |
| lead_interactions | 2200_18026_1_not_null | id IS NOT NULL |
| lead_interactions | 2200_18026_2_not_null | tenant_id IS NOT NULL |
| lead_interactions | 2200_18026_3_not_null | lead_id IS NOT NULL |
| lead_interactions | 2200_18026_4_not_null | tipo IS NOT NULL |
| lead_interactions | 2200_18026_6_not_null | data IS NOT NULL |
| lead_interactions | 2200_18026_8_not_null | created_at IS NOT NULL |
| lead_uploads | 2200_19381_10_not_null | created_at IS NOT NULL |
| lead_uploads | 2200_19381_1_not_null | id IS NOT NULL |
| lead_uploads | 2200_19381_2_not_null | tenant_id IS NOT NULL |
| lead_uploads | 2200_19381_3_not_null | lead_id IS NOT NULL |
| lead_uploads | 2200_19381_4_not_null | file_name IS NOT NULL |
| lead_uploads | 2200_19381_5_not_null | mime_type IS NOT NULL |
| lead_uploads | 2200_19381_6_not_null | extension IS NOT NULL |
| lead_uploads | 2200_19381_7_not_null | size IS NOT NULL |
| lead_uploads | 2200_19381_9_not_null | metadata IS NOT NULL |
| leads | 2200_22659_13_not_null | payload_servico IS NOT NULL |
| leads | 2200_22659_16_not_null | status IS NOT NULL |
| leads | 2200_22659_1_not_null | id IS NOT NULL |
| leads | 2200_22659_21_not_null | dados_internos_crm IS NOT NULL |
| leads | 2200_22659_29_not_null | tags IS NOT NULL |
| leads | 2200_22659_2_not_null | tenant_id IS NOT NULL |
| leads | 2200_22659_30_not_null | metadata IS NOT NULL |
| leads | 2200_22659_31_not_null | created_at IS NOT NULL |
| leads | 2200_22659_32_not_null | updated_at IS NOT NULL |
| leads | 2200_22659_3_not_null | nome IS NOT NULL |
| leave_requests | 2200_23058_14_not_null | metadata IS NOT NULL |
| leave_requests | 2200_23058_15_not_null | created_at IS NOT NULL |
| leave_requests | 2200_23058_16_not_null | updated_at IS NOT NULL |
| leave_requests | 2200_23058_1_not_null | id IS NOT NULL |
| leave_requests | 2200_23058_2_not_null | tenant_id IS NOT NULL |
| leave_requests | 2200_23058_4_not_null | employee_id IS NOT NULL |
| leave_requests | 2200_23058_5_not_null | tipo IS NOT NULL |
| leave_requests | 2200_23058_6_not_null | data_inicio IS NOT NULL |
| leave_requests | 2200_23058_7_not_null | data_fim IS NOT NULL |
| leave_requests | 2200_23058_9_not_null | status IS NOT NULL |
| licenses | 2200_22791_14_not_null | status IS NOT NULL |
| licenses | 2200_22791_18_not_null | moeda IS NOT NULL |
| licenses | 2200_22791_1_not_null | id IS NOT NULL |
| licenses | 2200_22791_22_not_null | created_at IS NOT NULL |
| licenses | 2200_22791_23_not_null | updated_at IS NOT NULL |
| licenses | 2200_22791_2_not_null | tenant_id IS NOT NULL |
| licenses | 2200_22791_3_not_null | titulo IS NOT NULL |
| licenses | CHK_licenses_percentage_range | ((percentage IS NULL) OR ((percentage >= (0)::numeric) AND (percentage <= (100)::numeric))) |
| marketing_asset_approvals | 2200_19636_10_not_null | requested_at IS NOT NULL |
| marketing_asset_approvals | 2200_19636_1_not_null | id IS NOT NULL |
| marketing_asset_approvals | 2200_19636_2_not_null | tenant_id IS NOT NULL |
| marketing_asset_approvals | 2200_19636_3_not_null | asset_id IS NOT NULL |
| marketing_asset_approvals | 2200_19636_4_not_null | version_id IS NOT NULL |
| marketing_asset_approvals | 2200_19636_5_not_null | status IS NOT NULL |
| marketing_asset_approvals | 2200_19636_9_not_null | metadata IS NOT NULL |
| marketing_asset_approvals | chk_marketing_asset_approvals_status | ((status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying, 'revision_requested'::character varying])::text[])) |
| marketing_asset_versions | 2200_19618_11_not_null | metadata IS NOT NULL |
| marketing_asset_versions | 2200_19618_13_not_null | created_at IS NOT NULL |
| marketing_asset_versions | 2200_19618_1_not_null | id IS NOT NULL |
| marketing_asset_versions | 2200_19618_2_not_null | tenant_id IS NOT NULL |
| marketing_asset_versions | 2200_19618_3_not_null | asset_id IS NOT NULL |
| marketing_asset_versions | 2200_19618_4_not_null | version IS NOT NULL |
| marketing_asset_versions | 2200_19618_5_not_null | status IS NOT NULL |
| marketing_asset_versions | 2200_19618_6_not_null | file_url IS NOT NULL |
| marketing_asset_versions | chk_marketing_asset_versions_status | ((status)::text = ANY ((ARRAY['draft'::character varying, 'in_review'::character varying, 'approved'::character varying, 'rejected'::character varying, 'archived'::character varying])::text[])) |
| marketing_asset_versions | chk_marketing_asset_versions_version_positive | (version > 0) |
| marketing_assets | 2200_19601_10_not_null | title IS NOT NULL |
| marketing_assets | 2200_19601_12_not_null | asset_type IS NOT NULL |
| marketing_assets | 2200_19601_13_not_null | status IS NOT NULL |
| marketing_assets | 2200_19601_14_not_null | current_version IS NOT NULL |
| marketing_assets | 2200_19601_1_not_null | id IS NOT NULL |
| marketing_assets | 2200_19601_20_not_null | tags IS NOT NULL |
| marketing_assets | 2200_19601_21_not_null | metadata IS NOT NULL |
| marketing_assets | 2200_19601_24_not_null | created_at IS NOT NULL |
| marketing_assets | 2200_19601_25_not_null | updated_at IS NOT NULL |
| marketing_assets | 2200_19601_2_not_null | tenant_id IS NOT NULL |
| marketing_assets | chk_marketing_assets_current_version_positive | (current_version > 0) |
| marketing_assets | chk_marketing_assets_status | ((status)::text = ANY ((ARRAY['draft'::character varying, 'in_review'::character varying, 'approved'::character varying, 'rejected'::character varying, 'archived'::character varying])::text[])) |
| marketing_assets | chk_marketing_assets_type | ((asset_type)::text = ANY ((ARRAY['AUDIO'::character varying, 'COVER'::character varying, 'ARTWORK'::character varying, 'PHOTO'::character varying, 'REEL'::character varying, 'TEASER'::character varying, 'VISUALIZER'::character varying, 'LYRIC_VIDEO'::character varying, 'MUSIC_VIDEO'::character varying, 'PRESS_KIT'::character varying, 'DOCUMENT'::character varying, 'INSTITUTIONAL'::character varying, 'AD_CREATIVE'::character varying, 'LOGO'::character varying, 'CORPORATE_MATERIAL'::character varying, 'OTHER'::character varying])::text[])) |
| marketing_content_posts | 2200_19819_10_not_null | publish_date IS NOT NULL |
| marketing_content_posts | 2200_19819_11_not_null | publish_time IS NOT NULL |
| marketing_content_posts | 2200_19819_12_not_null | scheduled_for IS NOT NULL |
| marketing_content_posts | 2200_19819_13_not_null | copy IS NOT NULL |
| marketing_content_posts | 2200_19819_19_not_null | files IS NOT NULL |
| marketing_content_posts | 2200_19819_1_not_null | id IS NOT NULL |
| marketing_content_posts | 2200_19819_20_not_null | metadata IS NOT NULL |
| marketing_content_posts | 2200_19819_27_not_null | created_at IS NOT NULL |
| marketing_content_posts | 2200_19819_28_not_null | updated_at IS NOT NULL |
| marketing_content_posts | 2200_19819_2_not_null | tenant_id IS NOT NULL |
| marketing_content_posts | 2200_19819_3_not_null | title IS NOT NULL |
| marketing_content_posts | 2200_19819_4_not_null | target_type IS NOT NULL |
| marketing_content_posts | 2200_19819_5_not_null | target_name IS NOT NULL |
| marketing_content_posts | 2200_19819_6_not_null | channel IS NOT NULL |
| marketing_content_posts | 2200_19819_7_not_null | content_type IS NOT NULL |
| marketing_content_posts | 2200_19819_8_not_null | status IS NOT NULL |
| marketing_content_posts | 2200_19819_9_not_null | publication_status IS NOT NULL |
| marketing_projects | 2200_22559_19_not_null | goals IS NOT NULL |
| marketing_projects | 2200_22559_1_not_null | id IS NOT NULL |
| marketing_projects | 2200_22559_20_not_null | metrics IS NOT NULL |
| marketing_projects | 2200_22559_21_not_null | context IS NOT NULL |
| marketing_projects | 2200_22559_22_not_null | metadata IS NOT NULL |
| marketing_projects | 2200_22559_23_not_null | created_at IS NOT NULL |
| marketing_projects | 2200_22559_24_not_null | updated_at IS NOT NULL |
| marketing_projects | 2200_22559_2_not_null | tenant_id IS NOT NULL |
| marketing_projects | 2200_22559_3_not_null | type IS NOT NULL |
| marketing_projects | 2200_22559_4_not_null | title IS NOT NULL |
| marketing_projects | 2200_22559_6_not_null | status IS NOT NULL |
| marketing_projects | 2200_22559_7_not_null | priority IS NOT NULL |
| marketing_projects | chk_marketing_projects_priority | ((priority)::text = ANY (ARRAY[('low'::character varying)::text, ('normal'::character varying)::text, ('high'::character varying)::text, ('urgent'::character varying)::text])) |
| marketing_projects | chk_marketing_projects_status | ((status)::text = ANY (ARRAY[('draft'::character varying)::text, ('planning'::character varying)::text, ('active'::character varying)::text, ('paused'::character varying)::text, ('completed'::character varying)::text, ('cancelled'::character varying)::text, ('archived'::character varying)::text])) |
| marketing_projects | chk_marketing_projects_type | ((type)::text = ANY (ARRAY[('MUSIC_PROJECT'::character varying)::text, ('ARTIST'::character varying)::text, ('COMPANY'::character varying)::text, ('LABEL'::character varying)::text, ('PUBLISHER'::character varying)::text, ('STUDIO'::character varying)::text, ('EVENT'::character varying)::text, ('CONTENT'::character varying)::text, ('CAMPAIGN'::character varying)::text, ('BRANDING'::character varying)::text, ('CORPORATE'::character varying)::text, ('PRODUCT'::character varying)::text, ('CUSTOM'::character varying)::text])) |
| marketing_strategies | 2200_19528_10_not_null | dependencies IS NOT NULL |
| marketing_strategies | 2200_19528_11_not_null | metrics IS NOT NULL |
| marketing_strategies | 2200_19528_12_not_null | metadata IS NOT NULL |
| marketing_strategies | 2200_19528_15_not_null | created_at IS NOT NULL |
| marketing_strategies | 2200_19528_16_not_null | updated_at IS NOT NULL |
| marketing_strategies | 2200_19528_1_not_null | id IS NOT NULL |
| marketing_strategies | 2200_19528_2_not_null | tenant_id IS NOT NULL |
| marketing_strategies | 2200_19528_3_not_null | marketing_project_id IS NOT NULL |
| marketing_strategies | 2200_19528_4_not_null | title IS NOT NULL |
| marketing_strategies | 2200_19528_7_not_null | priority IS NOT NULL |
| marketing_strategies | 2200_19528_9_not_null | status IS NOT NULL |
| marketing_strategy_actions | 2200_19573_10_not_null | status IS NOT NULL |
| marketing_strategy_actions | 2200_19573_11_not_null | dependencies IS NOT NULL |
| marketing_strategy_actions | 2200_19573_12_not_null | metrics IS NOT NULL |
| marketing_strategy_actions | 2200_19573_13_not_null | metadata IS NOT NULL |
| marketing_strategy_actions | 2200_19573_16_not_null | created_at IS NOT NULL |
| marketing_strategy_actions | 2200_19573_17_not_null | updated_at IS NOT NULL |
| marketing_strategy_actions | 2200_19573_1_not_null | id IS NOT NULL |
| marketing_strategy_actions | 2200_19573_2_not_null | tenant_id IS NOT NULL |
| marketing_strategy_actions | 2200_19573_3_not_null | marketing_project_id IS NOT NULL |
| marketing_strategy_actions | 2200_19573_4_not_null | initiative_id IS NOT NULL |
| marketing_strategy_actions | 2200_19573_5_not_null | title IS NOT NULL |
| marketing_strategy_actions | 2200_19573_8_not_null | priority IS NOT NULL |
| marketing_strategy_initiatives | 2200_19558_10_not_null | status IS NOT NULL |
| marketing_strategy_initiatives | 2200_19558_11_not_null | dependencies IS NOT NULL |
| marketing_strategy_initiatives | 2200_19558_12_not_null | metrics IS NOT NULL |
| marketing_strategy_initiatives | 2200_19558_13_not_null | metadata IS NOT NULL |
| marketing_strategy_initiatives | 2200_19558_16_not_null | created_at IS NOT NULL |
| marketing_strategy_initiatives | 2200_19558_17_not_null | updated_at IS NOT NULL |
| marketing_strategy_initiatives | 2200_19558_1_not_null | id IS NOT NULL |
| marketing_strategy_initiatives | 2200_19558_2_not_null | tenant_id IS NOT NULL |
| marketing_strategy_initiatives | 2200_19558_3_not_null | marketing_project_id IS NOT NULL |
| marketing_strategy_initiatives | 2200_19558_4_not_null | objective_id IS NOT NULL |
| marketing_strategy_initiatives | 2200_19558_5_not_null | title IS NOT NULL |
| marketing_strategy_initiatives | 2200_19558_8_not_null | priority IS NOT NULL |
| marketing_strategy_objectives | 2200_19543_10_not_null | status IS NOT NULL |
| marketing_strategy_objectives | 2200_19543_11_not_null | dependencies IS NOT NULL |
| marketing_strategy_objectives | 2200_19543_12_not_null | metrics IS NOT NULL |
| marketing_strategy_objectives | 2200_19543_13_not_null | metadata IS NOT NULL |
| marketing_strategy_objectives | 2200_19543_16_not_null | created_at IS NOT NULL |
| marketing_strategy_objectives | 2200_19543_17_not_null | updated_at IS NOT NULL |
| marketing_strategy_objectives | 2200_19543_1_not_null | id IS NOT NULL |
| marketing_strategy_objectives | 2200_19543_2_not_null | tenant_id IS NOT NULL |
| marketing_strategy_objectives | 2200_19543_3_not_null | marketing_project_id IS NOT NULL |
| marketing_strategy_objectives | 2200_19543_4_not_null | strategy_id IS NOT NULL |
| marketing_strategy_objectives | 2200_19543_5_not_null | title IS NOT NULL |
| marketing_strategy_objectives | 2200_19543_8_not_null | priority IS NOT NULL |
| marketing_tasks | 2200_22592_12_not_null | dependencies IS NOT NULL |
| marketing_tasks | 2200_22592_13_not_null | metrics IS NOT NULL |
| marketing_tasks | 2200_22592_14_not_null | task_key IS NOT NULL |
| marketing_tasks | 2200_22592_15_not_null | metadata IS NOT NULL |
| marketing_tasks | 2200_22592_16_not_null | created_at IS NOT NULL |
| marketing_tasks | 2200_22592_17_not_null | updated_at IS NOT NULL |
| marketing_tasks | 2200_22592_1_not_null | id IS NOT NULL |
| marketing_tasks | 2200_22592_2_not_null | tenant_id IS NOT NULL |
| marketing_tasks | 2200_22592_3_not_null | marketing_project_id IS NOT NULL |
| marketing_tasks | 2200_22592_4_not_null | title IS NOT NULL |
| marketing_tasks | 2200_22592_6_not_null | status IS NOT NULL |
| marketing_tasks | 2200_22592_8_not_null | priority IS NOT NULL |
| marketing_tasks | chk_marketing_tasks_priority | ((priority)::text = ANY (ARRAY[('low'::character varying)::text, ('normal'::character varying)::text, ('high'::character varying)::text, ('urgent'::character varying)::text])) |
| marketing_tasks | chk_marketing_tasks_status | ((status)::text = ANY (ARRAY[('pending'::character varying)::text, ('in_progress'::character varying)::text, ('review'::character varying)::text, ('blocked'::character varying)::text, ('done'::character varying)::text, ('cancelled'::character varying)::text])) |
| membership_job_functions | 2200_20497_1_not_null | id IS NOT NULL |
| membership_job_functions | 2200_20497_2_not_null | tenant_id IS NOT NULL |
| membership_job_functions | 2200_20497_3_not_null | membership_id IS NOT NULL |
| membership_job_functions | 2200_20497_4_not_null | job_function_id IS NOT NULL |
| membership_job_functions | 2200_20497_5_not_null | created_at IS NOT NULL |
| musicchat_automation_events | 2200_20308_1_not_null | id IS NOT NULL |
| musicchat_automation_events | 2200_20308_2_not_null | tenant_id IS NOT NULL |
| musicchat_automation_events | 2200_20308_4_not_null | event_type IS NOT NULL |
| musicchat_automation_events | 2200_20308_6_not_null | payload IS NOT NULL |
| musicchat_automation_events | 2200_20308_8_not_null | created_at IS NOT NULL |
| musicchat_automation_notifications | 2200_20323_10_not_null | metadata IS NOT NULL |
| musicchat_automation_notifications | 2200_20323_11_not_null | created_at IS NOT NULL |
| musicchat_automation_notifications | 2200_20323_1_not_null | id IS NOT NULL |
| musicchat_automation_notifications | 2200_20323_2_not_null | tenant_id IS NOT NULL |
| musicchat_automation_notifications | 2200_20323_3_not_null | conversation_id IS NOT NULL |
| musicchat_automation_notifications | 2200_20323_4_not_null | level IS NOT NULL |
| musicchat_automation_notifications | 2200_20323_5_not_null | channel IS NOT NULL |
| musicchat_automation_notifications | 2200_20323_6_not_null | recipient_user_id IS NOT NULL |
| musicchat_automation_notifications | 2200_20323_7_not_null | title IS NOT NULL |
| musicchat_automation_notifications | 2200_20323_9_not_null | status IS NOT NULL |
| musicchat_automation_settings | 2200_22937_10_not_null | invalid_option_message IS NOT NULL |
| musicchat_automation_settings | 2200_22937_11_not_null | absence_message IS NOT NULL |
| musicchat_automation_settings | 2200_22937_12_not_null | out_of_hours_message IS NOT NULL |
| musicchat_automation_settings | 2200_22937_13_not_null | closing_message IS NOT NULL |
| musicchat_automation_settings | 2200_22937_14_not_null | return_to_menu_rule IS NOT NULL |
| musicchat_automation_settings | 2200_22937_15_not_null | escalation_rules IS NOT NULL |
| musicchat_automation_settings | 2200_22937_16_not_null | notification_channels IS NOT NULL |
| musicchat_automation_settings | 2200_22937_19_not_null | created_at IS NOT NULL |
| musicchat_automation_settings | 2200_22937_1_not_null | id IS NOT NULL |
| musicchat_automation_settings | 2200_22937_20_not_null | updated_at IS NOT NULL |
| musicchat_automation_settings | 2200_22937_2_not_null | tenant_id IS NOT NULL |
| musicchat_automation_settings | 2200_22937_3_not_null | enabled IS NOT NULL |
| musicchat_automation_settings | 2200_22937_4_not_null | welcome_message IS NOT NULL |
| musicchat_automation_settings | 2200_22937_5_not_null | main_menu_message IS NOT NULL |
| musicchat_automation_settings | 2200_22937_6_not_null | menu_options IS NOT NULL |
| musicchat_automation_settings | 2200_22937_7_not_null | templates IS NOT NULL |
| musicchat_automation_settings | 2200_22937_8_not_null | required_fields IS NOT NULL |
| musicchat_automation_settings | 2200_22937_9_not_null | optional_fields IS NOT NULL |
| musicos360_migrations | 2200_17710_1_not_null | id IS NOT NULL |
| musicos360_migrations | 2200_17710_2_not_null | timestamp IS NOT NULL |
| musicos360_migrations | 2200_17710_3_not_null | name IS NOT NULL |
| notification_settings | 2200_20758_1_not_null | id IS NOT NULL |
| notification_settings | 2200_20758_2_not_null | tenant_id IS NOT NULL |
| notification_settings | 2200_20758_3_not_null | notification_key IS NOT NULL |
| notification_settings | 2200_20758_4_not_null | enabled IS NOT NULL |
| notification_settings | 2200_20758_5_not_null | config_json IS NOT NULL |
| notification_settings | 2200_20758_6_not_null | created_at IS NOT NULL |
| notification_settings | 2200_20758_7_not_null | updated_at IS NOT NULL |
| notifications | 2200_18154_10_not_null | metadata IS NOT NULL |
| notifications | 2200_18154_11_not_null | created_at IS NOT NULL |
| notifications | 2200_18154_1_not_null | id IS NOT NULL |
| notifications | 2200_18154_2_not_null | tenant_id IS NOT NULL |
| notifications | 2200_18154_3_not_null | user_id IS NOT NULL |
| notifications | 2200_18154_4_not_null | title IS NOT NULL |
| notifications | 2200_18154_6_not_null | type IS NOT NULL |
| oauth_connections | 2200_18199_10_not_null | created_at IS NOT NULL |
| oauth_connections | 2200_18199_11_not_null | updated_at IS NOT NULL |
| oauth_connections | 2200_18199_1_not_null | id IS NOT NULL |
| oauth_connections | 2200_18199_2_not_null | tenant_id IS NOT NULL |
| oauth_connections | 2200_18199_3_not_null | user_id IS NOT NULL |
| oauth_connections | 2200_18199_4_not_null | provider IS NOT NULL |
| oauth_connections | 2200_18199_5_not_null | access_token_encrypted IS NOT NULL |
| oauth_connections | 2200_18199_9_not_null | metadata IS NOT NULL |
| operational_list_items | 2200_21530_10_not_null | metadata IS NOT NULL |
| operational_list_items | 2200_21530_13_not_null | created_at IS NOT NULL |
| operational_list_items | 2200_21530_14_not_null | updated_at IS NOT NULL |
| operational_list_items | 2200_21530_1_not_null | id IS NOT NULL |
| operational_list_items | 2200_21530_2_not_null | tenant_id IS NOT NULL |
| operational_list_items | 2200_21530_3_not_null | kind IS NOT NULL |
| operational_list_items | 2200_21530_4_not_null | name IS NOT NULL |
| operational_list_items | 2200_21530_5_not_null | slug IS NOT NULL |
| operational_list_items | 2200_21530_7_not_null | active IS NOT NULL |
| operational_list_items | 2200_21530_8_not_null | order IS NOT NULL |
| operational_tasks | 2200_21224_14_not_null | created_at IS NOT NULL |
| operational_tasks | 2200_21224_15_not_null | updated_at IS NOT NULL |
| operational_tasks | 2200_21224_1_not_null | id IS NOT NULL |
| operational_tasks | 2200_21224_2_not_null | tenant_id IS NOT NULL |
| operational_tasks | 2200_21224_3_not_null | title IS NOT NULL |
| operational_tasks | 2200_21224_5_not_null | status IS NOT NULL |
| operational_tasks | 2200_21224_6_not_null | priority IS NOT NULL |
| org_members | 2200_22895_14_not_null | created_at IS NOT NULL |
| org_members | 2200_22895_15_not_null | updated_at IS NOT NULL |
| org_members | 2200_22895_1_not_null | id IS NOT NULL |
| org_members | 2200_22895_2_not_null | tenant_id IS NOT NULL |
| org_members | 2200_22895_3_not_null | auth_user_id IS NOT NULL |
| org_members | 2200_22895_4_not_null | email IS NOT NULL |
| org_members | 2200_22895_7_not_null | role IS NOT NULL |
| org_members | 2200_22895_8_not_null | is_active IS NOT NULL |
| org_members | 2200_22895_9_not_null | org_id IS NOT NULL |
| organizations | 2200_17804_10_not_null | address IS NOT NULL |
| organizations | 2200_17804_11_not_null | config IS NOT NULL |
| organizations | 2200_17804_12_not_null | metadata IS NOT NULL |
| organizations | 2200_17804_13_not_null | created_at IS NOT NULL |
| organizations | 2200_17804_14_not_null | updated_at IS NOT NULL |
| organizations | 2200_17804_16_not_null | is_system_tenant IS NOT NULL |
| organizations | 2200_17804_1_not_null | id IS NOT NULL |
| organizations | 2200_17804_3_not_null | name IS NOT NULL |
| organizations | 2200_17804_4_not_null | slug IS NOT NULL |
| organizations | 2200_17804_5_not_null | plan IS NOT NULL |
| organizations | 2200_17804_6_not_null | billing_status IS NOT NULL |
| organizations | 2200_17804_7_not_null | industry IS NOT NULL |
| payment_events | 2200_21459_1_not_null | id IS NOT NULL |
| payment_events | 2200_21459_2_not_null | stripe_event_id IS NOT NULL |
| payment_events | 2200_21459_4_not_null | event_type IS NOT NULL |
| payment_events | 2200_21459_5_not_null | payload IS NOT NULL |
| payment_events | 2200_21459_7_not_null | created_at IS NOT NULL |
| payroll_entries | 2200_22869_10_not_null | salario_liquido IS NOT NULL |
| payroll_entries | 2200_22869_12_not_null | status IS NOT NULL |
| payroll_entries | 2200_22869_16_not_null | metadata IS NOT NULL |
| payroll_entries | 2200_22869_17_not_null | created_at IS NOT NULL |
| payroll_entries | 2200_22869_18_not_null | updated_at IS NOT NULL |
| payroll_entries | 2200_22869_1_not_null | id IS NOT NULL |
| payroll_entries | 2200_22869_2_not_null | tenant_id IS NOT NULL |
| payroll_entries | 2200_22869_4_not_null | employee_id IS NOT NULL |
| payroll_entries | 2200_22869_6_not_null | competencia IS NOT NULL |
| payroll_entries | 2200_22869_7_not_null | salario_bruto IS NOT NULL |
| payroll_entries | 2200_22869_8_not_null | descontos IS NOT NULL |
| performance_metric_entries | 2200_21980_10_not_null | period_start IS NOT NULL |
| performance_metric_entries | 2200_21980_11_not_null | period_end IS NOT NULL |
| performance_metric_entries | 2200_21980_12_not_null | quantity IS NOT NULL |
| performance_metric_entries | 2200_21980_13_not_null | source IS NOT NULL |
| performance_metric_entries | 2200_21980_17_not_null | created_at IS NOT NULL |
| performance_metric_entries | 2200_21980_18_not_null | updated_at IS NOT NULL |
| performance_metric_entries | 2200_21980_1_not_null | id IS NOT NULL |
| performance_metric_entries | 2200_21980_2_not_null | tenant_id IS NOT NULL |
| performance_metric_entries | 2200_21980_3_not_null | metric_type IS NOT NULL |
| performance_metric_entries | 2200_21980_4_not_null | platform IS NOT NULL |
| performance_metric_entries | ck_metric_no_self_supersede | (superseded_by_id <> id) |
| performance_metric_entries | ck_metric_period_valid | (period_end >= period_start) |
| performance_metric_entries | ck_metric_single_target | (num_nonnulls(phonogram_id, release_id, artist_id) = 1) |
| performance_metric_entries | ck_metric_type_target_compat | (((metric_type = ANY (ARRAY['followers'::performance_metric_type, 'subscribers'::performance_metric_type, 'monthly_listeners'::performance_metric_type])) AND (artist_id IS NOT NULL)) OR ((metric_type <> ALL (ARRAY['followers'::performance_metric_type, 'subscribers'::performance_metric_type, 'monthly_listeners'::performance_metric_type])) AND ((phonogram_id IS NOT NULL) OR (release_id IS NOT NULL)))) |
| performance_metric_entries | performance_metric_entries_quantity_check | (quantity >= 0) |
| permission_aliases | 2200_20810_1_not_null | id IS NOT NULL |
| permission_aliases | 2200_20810_2_not_null | legacy_key IS NOT NULL |
| permission_aliases | 2200_20810_3_not_null | new_key IS NOT NULL |
| permission_aliases | 2200_20810_4_not_null | created_at IS NOT NULL |
| permission_aliases | chk_permission_aliases_distinct | ((legacy_key)::text <> (new_key)::text) |
| permission_conflicts | 2200_20879_1_not_null | id IS NOT NULL |
| permission_conflicts | 2200_20879_2_not_null | permission_id IS NOT NULL |
| permission_conflicts | 2200_20879_3_not_null | conflicts_with_permission_id IS NOT NULL |
| permission_conflicts | 2200_20879_4_not_null | created_at IS NOT NULL |
| permission_conflicts | chk_permission_conflicts_normalized | (permission_id < conflicts_with_permission_id) |
| permission_dependencies | 2200_20857_1_not_null | id IS NOT NULL |
| permission_dependencies | 2200_20857_2_not_null | permission_id IS NOT NULL |
| permission_dependencies | 2200_20857_3_not_null | depends_on_permission_id IS NOT NULL |
| permission_dependencies | 2200_20857_4_not_null | created_at IS NOT NULL |
| permission_dependencies | chk_permission_dependencies_distinct | (permission_id <> depends_on_permission_id) |
| permission_groups | 2200_20790_1_not_null | id IS NOT NULL |
| permission_groups | 2200_20790_2_not_null | key IS NOT NULL |
| permission_groups | 2200_20790_3_not_null | domain IS NOT NULL |
| permission_groups | 2200_20790_4_not_null | label IS NOT NULL |
| permission_groups | 2200_20790_5_not_null | sort_order IS NOT NULL |
| permission_groups | 2200_20790_6_not_null | created_at IS NOT NULL |
| permission_groups | chk_permission_groups_key_fmt | ((key)::text ~ '^[a-z][a-z0-9_]*$'::text) |
| permissions | 2200_20344_10_not_null | since_version IS NOT NULL |
| permissions | 2200_20344_13_not_null | is_assignable IS NOT NULL |
| permissions | 2200_20344_1_not_null | id IS NOT NULL |
| permissions | 2200_20344_2_not_null | resource IS NOT NULL |
| permissions | 2200_20344_3_not_null | action IS NOT NULL |
| permissions | 2200_20344_4_not_null | key IS NOT NULL |
| permissions | 2200_20344_6_not_null | created_at IS NOT NULL |
| permissions | 2200_20344_7_not_null | updated_at IS NOT NULL |
| permissions | chk_permissions_action_fmt | ((action)::text ~ '^[a-z][a-z0-9_]*$'::text) |
| permissions | chk_permissions_key_fmt | ((key)::text = (((resource)::text \|\| ':'::text) \|\| (action)::text)) |
| permissions | chk_permissions_resource_fmt | ((resource)::text ~ '^[a-z][a-z0-9_]*$'::text) |
| phonograms | 2200_22363_1_not_null | id IS NOT NULL |
| phonograms | 2200_22363_28_not_null | status IS NOT NULL |
| phonograms | 2200_22363_2_not_null | tenant_id IS NOT NULL |
| phonograms | 2200_22363_33_not_null | tipo IS NOT NULL |
| phonograms | 2200_22363_4_not_null | titulo IS NOT NULL |
| phonograms | 2200_22363_54_not_null | metadata IS NOT NULL |
| phonograms | 2200_22363_55_not_null | created_at IS NOT NULL |
| phonograms | 2200_22363_56_not_null | updated_at IS NOT NULL |
| phonograms | chk_phonograms_registry_status | ((registry_status IS NULL) OR ((registry_status)::text = ANY (ARRAY[('DRAFT'::character varying)::text, ('READY_FOR_VALIDATION'::character varying)::text, ('VALIDATED'::character varying)::text, ('READY_TO_SUBMIT'::character varying)::text, ('SUBMITTED'::character varying)::text, ('PROCESSING'::character varying)::text, ('APPROVED'::character varying)::text, ('REJECTED'::character varying)::text, ('REQUIRES_CORRECTION'::character varying)::text, ('FAILED'::character varying)::text, ('ARCHIVED'::character varying)::text]))) |
| pipeline_opportunities | 2200_18870_14_not_null | sla_breached IS NOT NULL |
| pipeline_opportunities | 2200_18870_17_not_null | stage_history IS NOT NULL |
| pipeline_opportunities | 2200_18870_18_not_null | metadata IS NOT NULL |
| pipeline_opportunities | 2200_18870_1_not_null | id IS NOT NULL |
| pipeline_opportunities | 2200_18870_21_not_null | created_at IS NOT NULL |
| pipeline_opportunities | 2200_18870_22_not_null | updated_at IS NOT NULL |
| pipeline_opportunities | 2200_18870_2_not_null | tenant_id IS NOT NULL |
| pipeline_opportunities | 2200_18870_3_not_null | pipeline_id IS NOT NULL |
| pipeline_opportunities | 2200_18870_5_not_null | title IS NOT NULL |
| pipeline_opportunities | 2200_18870_9_not_null | status IS NOT NULL |
| pipeline_stages | 2200_18851_10_not_null | is_won IS NOT NULL |
| pipeline_stages | 2200_18851_11_not_null | created_at IS NOT NULL |
| pipeline_stages | 2200_18851_12_not_null | updated_at IS NOT NULL |
| pipeline_stages | 2200_18851_1_not_null | id IS NOT NULL |
| pipeline_stages | 2200_18851_2_not_null | tenant_id IS NOT NULL |
| pipeline_stages | 2200_18851_3_not_null | pipeline_id IS NOT NULL |
| pipeline_stages | 2200_18851_4_not_null | name IS NOT NULL |
| pipeline_stages | 2200_18851_5_not_null | position IS NOT NULL |
| pipeline_stages | 2200_18851_6_not_null | color IS NOT NULL |
| pipeline_stages | 2200_18851_9_not_null | is_terminal IS NOT NULL |
| pipelines | 2200_18838_1_not_null | id IS NOT NULL |
| pipelines | 2200_18838_2_not_null | tenant_id IS NOT NULL |
| pipelines | 2200_18838_3_not_null | name IS NOT NULL |
| pipelines | 2200_18838_4_not_null | type IS NOT NULL |
| pipelines | 2200_18838_6_not_null | is_active IS NOT NULL |
| pipelines | 2200_18838_8_not_null | created_at IS NOT NULL |
| pipelines | 2200_18838_9_not_null | updated_at IS NOT NULL |
| positions | 2200_20436_10_not_null | updated_at IS NOT NULL |
| positions | 2200_20436_1_not_null | id IS NOT NULL |
| positions | 2200_20436_2_not_null | tenant_id IS NOT NULL |
| positions | 2200_20436_4_not_null | slug IS NOT NULL |
| positions | 2200_20436_5_not_null | name IS NOT NULL |
| positions | 2200_20436_7_not_null | is_active IS NOT NULL |
| positions | 2200_20436_8_not_null | sort_order IS NOT NULL |
| positions | 2200_20436_9_not_null | created_at IS NOT NULL |
| project_assets | 2200_20225_1_not_null | id IS NOT NULL |
| project_assets | 2200_20225_2_not_null | tenant_id IS NOT NULL |
| project_assets | 2200_20225_3_not_null | project_id IS NOT NULL |
| project_assets | 2200_20225_4_not_null | asset_id IS NOT NULL |
| project_assets | 2200_20225_5_not_null | role IS NOT NULL |
| project_assets | 2200_20225_8_not_null | created_at IS NOT NULL |
| project_track_participants | 2200_22097_1_not_null | id IS NOT NULL |
| project_track_participants | 2200_22097_2_not_null | tenant_id IS NOT NULL |
| project_track_participants | 2200_22097_3_not_null | project_track_id IS NOT NULL |
| project_track_participants | 2200_22097_4_not_null | nome IS NOT NULL |
| project_track_participants | 2200_22097_5_not_null | role IS NOT NULL |
| project_track_participants | 2200_22097_6_not_null | ordem IS NOT NULL |
| project_track_participants | 2200_22097_7_not_null | created_at IS NOT NULL |
| project_track_participants | chk_project_track_participants_role | ((role)::text = ANY ((ARRAY['compositor'::character varying, 'interprete'::character varying, 'produtor'::character varying])::text[])) |
| project_tracks | 2200_22081_14_not_null | ordem IS NOT NULL |
| project_tracks | 2200_22081_15_not_null | created_at IS NOT NULL |
| project_tracks | 2200_22081_16_not_null | updated_at IS NOT NULL |
| project_tracks | 2200_22081_1_not_null | id IS NOT NULL |
| project_tracks | 2200_22081_2_not_null | tenant_id IS NOT NULL |
| project_tracks | 2200_22081_3_not_null | project_id IS NOT NULL |
| project_tracks | 2200_22081_4_not_null | nome IS NOT NULL |
| projects | 2200_22451_11_not_null | metadata IS NOT NULL |
| projects | 2200_22451_12_not_null | created_at IS NOT NULL |
| projects | 2200_22451_13_not_null | updated_at IS NOT NULL |
| projects | 2200_22451_1_not_null | id IS NOT NULL |
| projects | 2200_22451_2_not_null | tenant_id IS NOT NULL |
| projects | 2200_22451_3_not_null | tipo IS NOT NULL |
| projects | 2200_22451_4_not_null | titulo IS NOT NULL |
| projects | 2200_22451_7_not_null | status IS NOT NULL |
| rbac_decision_logs | 2200_20970_11_not_null | resource IS NOT NULL |
| rbac_decision_logs | 2200_20970_12_not_null | action IS NOT NULL |
| rbac_decision_logs | 2200_20970_13_not_null | permission IS NOT NULL |
| rbac_decision_logs | 2200_20970_14_not_null | endpoint IS NOT NULL |
| rbac_decision_logs | 2200_20970_15_not_null | method IS NOT NULL |
| rbac_decision_logs | 2200_20970_16_not_null | active_decision IS NOT NULL |
| rbac_decision_logs | 2200_20970_17_not_null | shadow_decision IS NOT NULL |
| rbac_decision_logs | 2200_20970_18_not_null | comparison_result IS NOT NULL |
| rbac_decision_logs | 2200_20970_19_not_null | decision_source IS NOT NULL |
| rbac_decision_logs | 2200_20970_1_not_null | id IS NOT NULL |
| rbac_decision_logs | 2200_20970_21_not_null | would_allow IS NOT NULL |
| rbac_decision_logs | 2200_20970_22_not_null | would_deny IS NOT NULL |
| rbac_decision_logs | 2200_20970_23_not_null | latency_ms IS NOT NULL |
| rbac_decision_logs | 2200_20970_24_not_null | cache_hit IS NOT NULL |
| rbac_decision_logs | 2200_20970_25_not_null | authority_mode IS NOT NULL |
| rbac_decision_logs | 2200_20970_2_not_null | created_at IS NOT NULL |
| rbac_decision_logs | 2200_20970_3_not_null | request_id IS NOT NULL |
| rbac_decision_logs | 2200_20970_4_not_null | trace_id IS NOT NULL |
| rbac_decision_logs | rbac_decision_logs_active_decision_check | ((active_decision)::text = ANY ((ARRAY['ALLOW'::character varying, 'DENY'::character varying])::text[])) |
| rbac_decision_logs | rbac_decision_logs_authority_mode_check | ((authority_mode)::text = ANY ((ARRAY['OFF'::character varying, 'SHADOW'::character varying, 'ON'::character varying])::text[])) |
| rbac_decision_logs | rbac_decision_logs_comparison_result_check | ((comparison_result)::text = ANY ((ARRAY['ALLOW_MATCH'::character varying, 'DENY_MATCH'::character varying, 'WOULD_ALLOW'::character varying, 'WOULD_DENY'::character varying])::text[])) |
| rbac_decision_logs | rbac_decision_logs_shadow_decision_check | ((shadow_decision)::text = ANY ((ARRAY['ALLOW'::character varying, 'DENY'::character varying])::text[])) |
| rbac_decision_logs_2026_06 | 2200_20985_11_not_null | resource IS NOT NULL |
| rbac_decision_logs_2026_06 | 2200_20985_12_not_null | action IS NOT NULL |
| rbac_decision_logs_2026_06 | 2200_20985_13_not_null | permission IS NOT NULL |
| rbac_decision_logs_2026_06 | 2200_20985_14_not_null | endpoint IS NOT NULL |
| rbac_decision_logs_2026_06 | 2200_20985_15_not_null | method IS NOT NULL |
| rbac_decision_logs_2026_06 | 2200_20985_16_not_null | active_decision IS NOT NULL |
| rbac_decision_logs_2026_06 | 2200_20985_17_not_null | shadow_decision IS NOT NULL |
| rbac_decision_logs_2026_06 | 2200_20985_18_not_null | comparison_result IS NOT NULL |
| rbac_decision_logs_2026_06 | 2200_20985_19_not_null | decision_source IS NOT NULL |
| rbac_decision_logs_2026_06 | 2200_20985_1_not_null | id IS NOT NULL |
| rbac_decision_logs_2026_06 | 2200_20985_21_not_null | would_allow IS NOT NULL |
| rbac_decision_logs_2026_06 | 2200_20985_22_not_null | would_deny IS NOT NULL |
| rbac_decision_logs_2026_06 | 2200_20985_23_not_null | latency_ms IS NOT NULL |
| rbac_decision_logs_2026_06 | 2200_20985_24_not_null | cache_hit IS NOT NULL |
| rbac_decision_logs_2026_06 | 2200_20985_25_not_null | authority_mode IS NOT NULL |
| rbac_decision_logs_2026_06 | 2200_20985_2_not_null | created_at IS NOT NULL |
| rbac_decision_logs_2026_06 | 2200_20985_3_not_null | request_id IS NOT NULL |
| rbac_decision_logs_2026_06 | 2200_20985_4_not_null | trace_id IS NOT NULL |
| rbac_decision_logs_2026_06 | rbac_decision_logs_active_decision_check | ((active_decision)::text = ANY ((ARRAY['ALLOW'::character varying, 'DENY'::character varying])::text[])) |
| rbac_decision_logs_2026_06 | rbac_decision_logs_authority_mode_check | ((authority_mode)::text = ANY ((ARRAY['OFF'::character varying, 'SHADOW'::character varying, 'ON'::character varying])::text[])) |
| rbac_decision_logs_2026_06 | rbac_decision_logs_comparison_result_check | ((comparison_result)::text = ANY ((ARRAY['ALLOW_MATCH'::character varying, 'DENY_MATCH'::character varying, 'WOULD_ALLOW'::character varying, 'WOULD_DENY'::character varying])::text[])) |
| rbac_decision_logs_2026_06 | rbac_decision_logs_shadow_decision_check | ((shadow_decision)::text = ANY ((ARRAY['ALLOW'::character varying, 'DENY'::character varying])::text[])) |
| rbac_decision_logs_2026_07 | 2200_21002_11_not_null | resource IS NOT NULL |
| rbac_decision_logs_2026_07 | 2200_21002_12_not_null | action IS NOT NULL |
| rbac_decision_logs_2026_07 | 2200_21002_13_not_null | permission IS NOT NULL |
| rbac_decision_logs_2026_07 | 2200_21002_14_not_null | endpoint IS NOT NULL |
| rbac_decision_logs_2026_07 | 2200_21002_15_not_null | method IS NOT NULL |
| rbac_decision_logs_2026_07 | 2200_21002_16_not_null | active_decision IS NOT NULL |
| rbac_decision_logs_2026_07 | 2200_21002_17_not_null | shadow_decision IS NOT NULL |
| rbac_decision_logs_2026_07 | 2200_21002_18_not_null | comparison_result IS NOT NULL |
| rbac_decision_logs_2026_07 | 2200_21002_19_not_null | decision_source IS NOT NULL |
| rbac_decision_logs_2026_07 | 2200_21002_1_not_null | id IS NOT NULL |
| rbac_decision_logs_2026_07 | 2200_21002_21_not_null | would_allow IS NOT NULL |
| rbac_decision_logs_2026_07 | 2200_21002_22_not_null | would_deny IS NOT NULL |
| rbac_decision_logs_2026_07 | 2200_21002_23_not_null | latency_ms IS NOT NULL |
| rbac_decision_logs_2026_07 | 2200_21002_24_not_null | cache_hit IS NOT NULL |
| rbac_decision_logs_2026_07 | 2200_21002_25_not_null | authority_mode IS NOT NULL |
| rbac_decision_logs_2026_07 | 2200_21002_2_not_null | created_at IS NOT NULL |
| rbac_decision_logs_2026_07 | 2200_21002_3_not_null | request_id IS NOT NULL |
| rbac_decision_logs_2026_07 | 2200_21002_4_not_null | trace_id IS NOT NULL |
| rbac_decision_logs_2026_07 | rbac_decision_logs_active_decision_check | ((active_decision)::text = ANY ((ARRAY['ALLOW'::character varying, 'DENY'::character varying])::text[])) |
| rbac_decision_logs_2026_07 | rbac_decision_logs_authority_mode_check | ((authority_mode)::text = ANY ((ARRAY['OFF'::character varying, 'SHADOW'::character varying, 'ON'::character varying])::text[])) |
| rbac_decision_logs_2026_07 | rbac_decision_logs_comparison_result_check | ((comparison_result)::text = ANY ((ARRAY['ALLOW_MATCH'::character varying, 'DENY_MATCH'::character varying, 'WOULD_ALLOW'::character varying, 'WOULD_DENY'::character varying])::text[])) |
| rbac_decision_logs_2026_07 | rbac_decision_logs_shadow_decision_check | ((shadow_decision)::text = ANY ((ARRAY['ALLOW'::character varying, 'DENY'::character varying])::text[])) |
| rbac_decision_logs_2026_08 | 2200_21019_11_not_null | resource IS NOT NULL |
| rbac_decision_logs_2026_08 | 2200_21019_12_not_null | action IS NOT NULL |
| rbac_decision_logs_2026_08 | 2200_21019_13_not_null | permission IS NOT NULL |
| rbac_decision_logs_2026_08 | 2200_21019_14_not_null | endpoint IS NOT NULL |
| rbac_decision_logs_2026_08 | 2200_21019_15_not_null | method IS NOT NULL |
| rbac_decision_logs_2026_08 | 2200_21019_16_not_null | active_decision IS NOT NULL |
| rbac_decision_logs_2026_08 | 2200_21019_17_not_null | shadow_decision IS NOT NULL |
| rbac_decision_logs_2026_08 | 2200_21019_18_not_null | comparison_result IS NOT NULL |
| rbac_decision_logs_2026_08 | 2200_21019_19_not_null | decision_source IS NOT NULL |
| rbac_decision_logs_2026_08 | 2200_21019_1_not_null | id IS NOT NULL |
| rbac_decision_logs_2026_08 | 2200_21019_21_not_null | would_allow IS NOT NULL |
| rbac_decision_logs_2026_08 | 2200_21019_22_not_null | would_deny IS NOT NULL |
| rbac_decision_logs_2026_08 | 2200_21019_23_not_null | latency_ms IS NOT NULL |
| rbac_decision_logs_2026_08 | 2200_21019_24_not_null | cache_hit IS NOT NULL |
| rbac_decision_logs_2026_08 | 2200_21019_25_not_null | authority_mode IS NOT NULL |
| rbac_decision_logs_2026_08 | 2200_21019_2_not_null | created_at IS NOT NULL |
| rbac_decision_logs_2026_08 | 2200_21019_3_not_null | request_id IS NOT NULL |
| rbac_decision_logs_2026_08 | 2200_21019_4_not_null | trace_id IS NOT NULL |
| rbac_decision_logs_2026_08 | rbac_decision_logs_active_decision_check | ((active_decision)::text = ANY ((ARRAY['ALLOW'::character varying, 'DENY'::character varying])::text[])) |
| rbac_decision_logs_2026_08 | rbac_decision_logs_authority_mode_check | ((authority_mode)::text = ANY ((ARRAY['OFF'::character varying, 'SHADOW'::character varying, 'ON'::character varying])::text[])) |
| rbac_decision_logs_2026_08 | rbac_decision_logs_comparison_result_check | ((comparison_result)::text = ANY ((ARRAY['ALLOW_MATCH'::character varying, 'DENY_MATCH'::character varying, 'WOULD_ALLOW'::character varying, 'WOULD_DENY'::character varying])::text[])) |
| rbac_decision_logs_2026_08 | rbac_decision_logs_shadow_decision_check | ((shadow_decision)::text = ANY ((ARRAY['ALLOW'::character varying, 'DENY'::character varying])::text[])) |
| rbac_decision_logs_2026_09 | 2200_21036_11_not_null | resource IS NOT NULL |
| rbac_decision_logs_2026_09 | 2200_21036_12_not_null | action IS NOT NULL |
| rbac_decision_logs_2026_09 | 2200_21036_13_not_null | permission IS NOT NULL |
| rbac_decision_logs_2026_09 | 2200_21036_14_not_null | endpoint IS NOT NULL |
| rbac_decision_logs_2026_09 | 2200_21036_15_not_null | method IS NOT NULL |
| rbac_decision_logs_2026_09 | 2200_21036_16_not_null | active_decision IS NOT NULL |
| rbac_decision_logs_2026_09 | 2200_21036_17_not_null | shadow_decision IS NOT NULL |
| rbac_decision_logs_2026_09 | 2200_21036_18_not_null | comparison_result IS NOT NULL |
| rbac_decision_logs_2026_09 | 2200_21036_19_not_null | decision_source IS NOT NULL |
| rbac_decision_logs_2026_09 | 2200_21036_1_not_null | id IS NOT NULL |
| rbac_decision_logs_2026_09 | 2200_21036_21_not_null | would_allow IS NOT NULL |
| rbac_decision_logs_2026_09 | 2200_21036_22_not_null | would_deny IS NOT NULL |
| rbac_decision_logs_2026_09 | 2200_21036_23_not_null | latency_ms IS NOT NULL |
| rbac_decision_logs_2026_09 | 2200_21036_24_not_null | cache_hit IS NOT NULL |
| rbac_decision_logs_2026_09 | 2200_21036_25_not_null | authority_mode IS NOT NULL |
| rbac_decision_logs_2026_09 | 2200_21036_2_not_null | created_at IS NOT NULL |
| rbac_decision_logs_2026_09 | 2200_21036_3_not_null | request_id IS NOT NULL |
| rbac_decision_logs_2026_09 | 2200_21036_4_not_null | trace_id IS NOT NULL |
| rbac_decision_logs_2026_09 | rbac_decision_logs_active_decision_check | ((active_decision)::text = ANY ((ARRAY['ALLOW'::character varying, 'DENY'::character varying])::text[])) |
| rbac_decision_logs_2026_09 | rbac_decision_logs_authority_mode_check | ((authority_mode)::text = ANY ((ARRAY['OFF'::character varying, 'SHADOW'::character varying, 'ON'::character varying])::text[])) |
| rbac_decision_logs_2026_09 | rbac_decision_logs_comparison_result_check | ((comparison_result)::text = ANY ((ARRAY['ALLOW_MATCH'::character varying, 'DENY_MATCH'::character varying, 'WOULD_ALLOW'::character varying, 'WOULD_DENY'::character varying])::text[])) |
| rbac_decision_logs_2026_09 | rbac_decision_logs_shadow_decision_check | ((shadow_decision)::text = ANY ((ARRAY['ALLOW'::character varying, 'DENY'::character varying])::text[])) |
| rbac_decision_logs_2026_10 | 2200_23498_11_not_null | resource IS NOT NULL |
| rbac_decision_logs_2026_10 | 2200_23498_12_not_null | action IS NOT NULL |
| rbac_decision_logs_2026_10 | 2200_23498_13_not_null | permission IS NOT NULL |
| rbac_decision_logs_2026_10 | 2200_23498_14_not_null | endpoint IS NOT NULL |
| rbac_decision_logs_2026_10 | 2200_23498_15_not_null | method IS NOT NULL |
| rbac_decision_logs_2026_10 | 2200_23498_16_not_null | active_decision IS NOT NULL |
| rbac_decision_logs_2026_10 | 2200_23498_17_not_null | shadow_decision IS NOT NULL |
| rbac_decision_logs_2026_10 | 2200_23498_18_not_null | comparison_result IS NOT NULL |
| rbac_decision_logs_2026_10 | 2200_23498_19_not_null | decision_source IS NOT NULL |
| rbac_decision_logs_2026_10 | 2200_23498_1_not_null | id IS NOT NULL |
| rbac_decision_logs_2026_10 | 2200_23498_21_not_null | would_allow IS NOT NULL |
| rbac_decision_logs_2026_10 | 2200_23498_22_not_null | would_deny IS NOT NULL |
| rbac_decision_logs_2026_10 | 2200_23498_23_not_null | latency_ms IS NOT NULL |
| rbac_decision_logs_2026_10 | 2200_23498_24_not_null | cache_hit IS NOT NULL |
| rbac_decision_logs_2026_10 | 2200_23498_25_not_null | authority_mode IS NOT NULL |
| rbac_decision_logs_2026_10 | 2200_23498_2_not_null | created_at IS NOT NULL |
| rbac_decision_logs_2026_10 | 2200_23498_3_not_null | request_id IS NOT NULL |
| rbac_decision_logs_2026_10 | 2200_23498_4_not_null | trace_id IS NOT NULL |
| rbac_decision_logs_2026_10 | rbac_decision_logs_active_decision_check | ((active_decision)::text = ANY ((ARRAY['ALLOW'::character varying, 'DENY'::character varying])::text[])) |
| rbac_decision_logs_2026_10 | rbac_decision_logs_authority_mode_check | ((authority_mode)::text = ANY ((ARRAY['OFF'::character varying, 'SHADOW'::character varying, 'ON'::character varying])::text[])) |
| rbac_decision_logs_2026_10 | rbac_decision_logs_comparison_result_check | ((comparison_result)::text = ANY ((ARRAY['ALLOW_MATCH'::character varying, 'DENY_MATCH'::character varying, 'WOULD_ALLOW'::character varying, 'WOULD_DENY'::character varying])::text[])) |
| rbac_decision_logs_2026_10 | rbac_decision_logs_shadow_decision_check | ((shadow_decision)::text = ANY ((ARRAY['ALLOW'::character varying, 'DENY'::character varying])::text[])) |
| rbac_decision_logs_default | 2200_21053_11_not_null | resource IS NOT NULL |
| rbac_decision_logs_default | 2200_21053_12_not_null | action IS NOT NULL |
| rbac_decision_logs_default | 2200_21053_13_not_null | permission IS NOT NULL |
| rbac_decision_logs_default | 2200_21053_14_not_null | endpoint IS NOT NULL |
| rbac_decision_logs_default | 2200_21053_15_not_null | method IS NOT NULL |
| rbac_decision_logs_default | 2200_21053_16_not_null | active_decision IS NOT NULL |
| rbac_decision_logs_default | 2200_21053_17_not_null | shadow_decision IS NOT NULL |
| rbac_decision_logs_default | 2200_21053_18_not_null | comparison_result IS NOT NULL |
| rbac_decision_logs_default | 2200_21053_19_not_null | decision_source IS NOT NULL |
| rbac_decision_logs_default | 2200_21053_1_not_null | id IS NOT NULL |
| rbac_decision_logs_default | 2200_21053_21_not_null | would_allow IS NOT NULL |
| rbac_decision_logs_default | 2200_21053_22_not_null | would_deny IS NOT NULL |
| rbac_decision_logs_default | 2200_21053_23_not_null | latency_ms IS NOT NULL |
| rbac_decision_logs_default | 2200_21053_24_not_null | cache_hit IS NOT NULL |
| rbac_decision_logs_default | 2200_21053_25_not_null | authority_mode IS NOT NULL |
| rbac_decision_logs_default | 2200_21053_2_not_null | created_at IS NOT NULL |
| rbac_decision_logs_default | 2200_21053_3_not_null | request_id IS NOT NULL |
| rbac_decision_logs_default | 2200_21053_4_not_null | trace_id IS NOT NULL |
| rbac_decision_logs_default | rbac_decision_logs_active_decision_check | ((active_decision)::text = ANY ((ARRAY['ALLOW'::character varying, 'DENY'::character varying])::text[])) |
| rbac_decision_logs_default | rbac_decision_logs_authority_mode_check | ((authority_mode)::text = ANY ((ARRAY['OFF'::character varying, 'SHADOW'::character varying, 'ON'::character varying])::text[])) |
| rbac_decision_logs_default | rbac_decision_logs_comparison_result_check | ((comparison_result)::text = ANY ((ARRAY['ALLOW_MATCH'::character varying, 'DENY_MATCH'::character varying, 'WOULD_ALLOW'::character varying, 'WOULD_DENY'::character varying])::text[])) |
| rbac_decision_logs_default | rbac_decision_logs_shadow_decision_check | ((shadow_decision)::text = ANY ((ARRAY['ALLOW'::character varying, 'DENY'::character varying])::text[])) |
| rbac_error_logs | 2200_21414_12_not_null | metadata IS NOT NULL |
| rbac_error_logs | 2200_21414_1_not_null | id IS NOT NULL |
| rbac_error_logs | 2200_21414_2_not_null | created_at IS NOT NULL |
| rbac_error_logs | 2200_21414_7_not_null | error_type IS NOT NULL |
| rbac_error_logs | 2200_21414_8_not_null | error_source IS NOT NULL |
| release_works | 2200_20601_1_not_null | release_id IS NOT NULL |
| release_works | 2200_20601_2_not_null | work_id IS NOT NULL |
| releases | 2200_22408_14_not_null | plataformas IS NOT NULL |
| releases | 2200_22408_1_not_null | id IS NOT NULL |
| releases | 2200_22408_20_not_null | status IS NOT NULL |
| releases | 2200_22408_21_not_null | metadata IS NOT NULL |
| releases | 2200_22408_22_not_null | created_at IS NOT NULL |
| releases | 2200_22408_23_not_null | updated_at IS NOT NULL |
| releases | 2200_22408_2_not_null | tenant_id IS NOT NULL |
| releases | 2200_22408_3_not_null | titulo IS NOT NULL |
| releases | 2200_22408_4_not_null | tipo IS NOT NULL |
| rights_holders | 2200_22749_11_not_null | holder_type IS NOT NULL |
| rights_holders | 2200_22749_12_not_null | metadata IS NOT NULL |
| rights_holders | 2200_22749_13_not_null | created_at IS NOT NULL |
| rights_holders | 2200_22749_14_not_null | updated_at IS NOT NULL |
| rights_holders | 2200_22749_1_not_null | id IS NOT NULL |
| rights_holders | 2200_22749_2_not_null | tenant_id IS NOT NULL |
| rights_holders | 2200_22749_3_not_null | legal_name IS NOT NULL |
| rights_holders | chk_rights_holders_holder_type | ((holder_type)::text = ANY (ARRAY[('AUTHOR'::character varying)::text, ('COMPOSER'::character varying)::text, ('PUBLISHER'::character varying)::text, ('INTERPRETER'::character varying)::text, ('MUSICIAN'::character varying)::text, ('PHONOGRAPHIC_PRODUCER'::character varying)::text, ('LABEL'::character varying)::text, ('ARRANGER'::character varying)::text, ('ADAPTER'::character varying)::text, ('TRANSLATOR'::character varying)::text, ('OTHER'::character varying)::text])) |
| role_inheritance | 2200_20918_1_not_null | id IS NOT NULL |
| role_inheritance | 2200_20918_3_not_null | child_role_id IS NOT NULL |
| role_inheritance | 2200_20918_4_not_null | parent_role_id IS NOT NULL |
| role_inheritance | 2200_20918_7_not_null | created_at IS NOT NULL |
| role_inheritance | 2200_20918_8_not_null | updated_at IS NOT NULL |
| role_inheritance | chk_role_inheritance_distinct_roles | (child_role_id <> parent_role_id) |
| role_permissions | 2200_20390_1_not_null | id IS NOT NULL |
| role_permissions | 2200_20390_2_not_null | role_id IS NOT NULL |
| role_permissions | 2200_20390_3_not_null | permission_id IS NOT NULL |
| role_permissions | 2200_20390_4_not_null | created_at IS NOT NULL |
| role_template_permissions | 2200_20836_1_not_null | id IS NOT NULL |
| role_template_permissions | 2200_20836_2_not_null | template_id IS NOT NULL |
| role_template_permissions | 2200_20836_3_not_null | permission_id IS NOT NULL |
| role_template_permissions | 2200_20836_4_not_null | created_at IS NOT NULL |
| role_templates | 2200_20820_1_not_null | id IS NOT NULL |
| role_templates | 2200_20820_2_not_null | key IS NOT NULL |
| role_templates | 2200_20820_3_not_null | name IS NOT NULL |
| role_templates | 2200_20820_5_not_null | version IS NOT NULL |
| role_templates | 2200_20820_6_not_null | is_system IS NOT NULL |
| role_templates | 2200_20820_7_not_null | created_at IS NOT NULL |
| role_templates | 2200_20820_8_not_null | updated_at IS NOT NULL |
| role_templates | chk_role_templates_version | (version >= 1) |
| roles | 2200_20362_10_not_null | created_at IS NOT NULL |
| roles | 2200_20362_11_not_null | updated_at IS NOT NULL |
| roles | 2200_20362_16_not_null | current_version IS NOT NULL |
| roles | 2200_20362_1_not_null | id IS NOT NULL |
| roles | 2200_20362_4_not_null | slug IS NOT NULL |
| roles | 2200_20362_5_not_null | name IS NOT NULL |
| roles | 2200_20362_7_not_null | hierarchy_level IS NOT NULL |
| roles | 2200_20362_8_not_null | is_system IS NOT NULL |
| roles | 2200_20362_9_not_null | is_assignable IS NOT NULL |
| roles | chk_roles_current_version | (current_version >= 1) |
| roles | chk_roles_hierarchy | ((hierarchy_level >= 0) AND (hierarchy_level <= 100)) |
| roles | chk_roles_system_global | ((NOT is_system) OR (tenant_id IS NULL)) |
| shares | 2200_22766_1_not_null | id IS NOT NULL |
| shares | 2200_22766_20_not_null | status IS NOT NULL |
| shares | 2200_22766_2_not_null | tenant_id IS NOT NULL |
| shares | 2200_22766_40_not_null | metadata IS NOT NULL |
| shares | 2200_22766_41_not_null | created_at IS NOT NULL |
| shares | 2200_22766_42_not_null | updated_at IS NOT NULL |
| shares | 2200_22766_7_not_null | papel IS NOT NULL |
| skill_run_logs | 2200_20184_1_not_null | id IS NOT NULL |
| skill_run_logs | 2200_20184_2_not_null | skill_run_id IS NOT NULL |
| skill_run_logs | 2200_20184_3_not_null | level IS NOT NULL |
| skill_run_logs | 2200_20184_4_not_null | message IS NOT NULL |
| skill_run_logs | 2200_20184_6_not_null | created_at IS NOT NULL |
| skill_runs | 2200_20168_14_not_null | created_at IS NOT NULL |
| skill_runs | 2200_20168_1_not_null | id IS NOT NULL |
| skill_runs | 2200_20168_2_not_null | tenant_id IS NOT NULL |
| skill_runs | 2200_20168_4_not_null | skill_name IS NOT NULL |
| skill_runs | 2200_20168_8_not_null | status IS NOT NULL |
| skill_runs | 2200_20168_9_not_null | input_payload IS NOT NULL |
| society_accounts | 2200_19722_10_not_null | created_at IS NOT NULL |
| society_accounts | 2200_19722_11_not_null | updated_at IS NOT NULL |
| society_accounts | 2200_19722_1_not_null | id IS NOT NULL |
| society_accounts | 2200_19722_2_not_null | tenant_id IS NOT NULL |
| society_accounts | 2200_19722_3_not_null | society IS NOT NULL |
| society_accounts | 2200_19722_4_not_null | driver IS NOT NULL |
| society_accounts | 2200_19722_5_not_null | account_name IS NOT NULL |
| society_accounts | 2200_19722_8_not_null | status IS NOT NULL |
| society_accounts | 2200_19722_9_not_null | metadata IS NOT NULL |
| society_accounts | chk_society_accounts_driver | ((driver)::text = ANY ((ARRAY['MANUAL_EXPORT'::character varying, 'PARTNER_API'::character varying, 'PORTAL_RPA'::character varying])::text[])) |
| society_accounts | chk_society_accounts_status | ((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'INACTIVE'::character varying, 'PENDING'::character varying, 'ERROR'::character varying])::text[])) |
| society_payload_snapshots | 2200_19774_1_not_null | id IS NOT NULL |
| society_payload_snapshots | 2200_19774_2_not_null | tenant_id IS NOT NULL |
| society_payload_snapshots | 2200_19774_3_not_null | submission_id IS NOT NULL |
| society_payload_snapshots | 2200_19774_4_not_null | version IS NOT NULL |
| society_payload_snapshots | 2200_19774_5_not_null | payload IS NOT NULL |
| society_payload_snapshots | 2200_19774_6_not_null | payload_hash IS NOT NULL |
| society_payload_snapshots | 2200_19774_8_not_null | created_at IS NOT NULL |
| society_submission_events | 2200_19757_10_not_null | created_at IS NOT NULL |
| society_submission_events | 2200_19757_1_not_null | id IS NOT NULL |
| society_submission_events | 2200_19757_2_not_null | tenant_id IS NOT NULL |
| society_submission_events | 2200_19757_3_not_null | submission_id IS NOT NULL |
| society_submission_events | 2200_19757_6_not_null | event_type IS NOT NULL |
| society_submission_events | 2200_19757_8_not_null | metadata IS NOT NULL |
| society_submissions | 2200_19738_17_not_null | metadata IS NOT NULL |
| society_submissions | 2200_19738_18_not_null | created_at IS NOT NULL |
| society_submissions | 2200_19738_19_not_null | updated_at IS NOT NULL |
| society_submissions | 2200_19738_1_not_null | id IS NOT NULL |
| society_submissions | 2200_19738_2_not_null | tenant_id IS NOT NULL |
| society_submissions | 2200_19738_4_not_null | society IS NOT NULL |
| society_submissions | 2200_19738_5_not_null | driver IS NOT NULL |
| society_submissions | 2200_19738_6_not_null | entity_type IS NOT NULL |
| society_submissions | 2200_19738_7_not_null | entity_id IS NOT NULL |
| society_submissions | 2200_19738_8_not_null | status IS NOT NULL |
| society_submissions | chk_society_submissions_driver | ((driver)::text = ANY ((ARRAY['MANUAL_EXPORT'::character varying, 'PARTNER_API'::character varying, 'PORTAL_RPA'::character varying])::text[])) |
| society_submissions | chk_society_submissions_entity | ((entity_type)::text = ANY ((ARRAY['WORK'::character varying, 'RECORDING'::character varying, 'RIGHTS_HOLDER'::character varying, 'RELEASE'::character varying, 'SUBMISSION'::character varying])::text[])) |
| society_submissions | chk_society_submissions_status | ((status)::text = ANY ((ARRAY['DRAFT'::character varying, 'VALIDATING'::character varying, 'VALID'::character varying, 'INVALID'::character varying, 'READY'::character varying, 'EXPORTED'::character varying, 'SUBMITTED'::character varying, 'PROCESSING'::character varying, 'APPROVED'::character varying, 'REJECTED'::character varying, 'REQUIRES_CORRECTION'::character varying, 'FAILED'::character varying, 'CANCELLED'::character varying])::text[])) |
| society_sync_jobs | 2200_19805_11_not_null | created_at IS NOT NULL |
| society_sync_jobs | 2200_19805_1_not_null | id IS NOT NULL |
| society_sync_jobs | 2200_19805_2_not_null | tenant_id IS NOT NULL |
| society_sync_jobs | 2200_19805_3_not_null | society IS NOT NULL |
| society_sync_jobs | 2200_19805_4_not_null | driver IS NOT NULL |
| society_sync_jobs | 2200_19805_5_not_null | status IS NOT NULL |
| society_sync_jobs | 2200_19805_9_not_null | metadata IS NOT NULL |
| society_sync_jobs | chk_society_sync_status | ((status)::text = ANY ((ARRAY['PENDING'::character varying, 'RUNNING'::character varying, 'SUCCESS'::character varying, 'FAILED'::character varying, 'CANCELLED'::character varying])::text[])) |
| society_validation_errors | 2200_19792_10_not_null | created_at IS NOT NULL |
| society_validation_errors | 2200_19792_1_not_null | id IS NOT NULL |
| society_validation_errors | 2200_19792_2_not_null | tenant_id IS NOT NULL |
| society_validation_errors | 2200_19792_4_not_null | entity_type IS NOT NULL |
| society_validation_errors | 2200_19792_5_not_null | entity_id IS NOT NULL |
| society_validation_errors | 2200_19792_6_not_null | severity IS NOT NULL |
| society_validation_errors | 2200_19792_8_not_null | code IS NOT NULL |
| society_validation_errors | 2200_19792_9_not_null | message IS NOT NULL |
| society_validation_errors | chk_society_validation_severity | ((severity)::text = ANY ((ARRAY['ERROR'::character varying, 'WARNING'::character varying, 'INFO'::character varying])::text[])) |
| support_tickets | 2200_18136_13_not_null | tags IS NOT NULL |
| support_tickets | 2200_18136_14_not_null | metadata IS NOT NULL |
| support_tickets | 2200_18136_15_not_null | created_at IS NOT NULL |
| support_tickets | 2200_18136_16_not_null | updated_at IS NOT NULL |
| support_tickets | 2200_18136_1_not_null | id IS NOT NULL |
| support_tickets | 2200_18136_2_not_null | tenant_id IS NOT NULL |
| support_tickets | 2200_18136_3_not_null | ticket_number IS NOT NULL |
| support_tickets | 2200_18136_4_not_null | subject IS NOT NULL |
| support_tickets | 2200_18136_6_not_null | status IS NOT NULL |
| support_tickets | 2200_18136_7_not_null | priority IS NOT NULL |
| support_tickets | 2200_18136_9_not_null | created_by IS NOT NULL |
| takedowns | 2200_22808_16_not_null | metadata IS NOT NULL |
| takedowns | 2200_22808_17_not_null | created_at IS NOT NULL |
| takedowns | 2200_22808_18_not_null | updated_at IS NOT NULL |
| takedowns | 2200_22808_1_not_null | id IS NOT NULL |
| takedowns | 2200_22808_2_not_null | tenant_id IS NOT NULL |
| takedowns | 2200_22808_3_not_null | titulo IS NOT NULL |
| takedowns | 2200_22808_7_not_null | status IS NOT NULL |
| takedowns | 2200_22808_9_not_null | plataforma IS NOT NULL |
| task_assets | 2200_20236_1_not_null | id IS NOT NULL |
| task_assets | 2200_20236_2_not_null | tenant_id IS NOT NULL |
| task_assets | 2200_20236_3_not_null | task_id IS NOT NULL |
| task_assets | 2200_20236_4_not_null | asset_id IS NOT NULL |
| task_assets | 2200_20236_5_not_null | role IS NOT NULL |
| task_assets | 2200_20236_8_not_null | created_at IS NOT NULL |
| tenant_billing_state | 2200_21436_11_not_null | created_at IS NOT NULL |
| tenant_billing_state | 2200_21436_12_not_null | updated_at IS NOT NULL |
| tenant_billing_state | 2200_21436_1_not_null | id IS NOT NULL |
| tenant_billing_state | 2200_21436_2_not_null | tenant_id IS NOT NULL |
| tenant_billing_state | 2200_21436_3_not_null | status IS NOT NULL |
| tenant_billing_state | 2200_21436_8_not_null | manual_override IS NOT NULL |
| tenant_billing_state | chk_tenant_billing_state_status | ((status)::text = ANY ((ARRAY['active'::character varying, 'trial'::character varying, 'payment_grace'::character varying, 'read_only'::character varying, 'suspended'::character varying, 'cancelled'::character varying])::text[])) |
| tenant_invitations | 2200_21112_12_not_null | last_sent_at IS NOT NULL |
| tenant_invitations | 2200_21112_13_not_null | created_at IS NOT NULL |
| tenant_invitations | 2200_21112_14_not_null | updated_at IS NOT NULL |
| tenant_invitations | 2200_21112_1_not_null | id IS NOT NULL |
| tenant_invitations | 2200_21112_2_not_null | tenant_id IS NOT NULL |
| tenant_invitations | 2200_21112_3_not_null | org_id IS NOT NULL |
| tenant_invitations | 2200_21112_4_not_null | email IS NOT NULL |
| tenant_invitations | 2200_21112_5_not_null | role_id IS NOT NULL |
| tenant_invitations | 2200_21112_7_not_null | invited_by IS NOT NULL |
| tenant_invitations | 2200_21112_8_not_null | status IS NOT NULL |
| tenant_invitations | 2200_21112_9_not_null | expires_at IS NOT NULL |
| tenant_invitations | tenant_invitations_status_check | ((status)::text = ANY ((ARRAY['pending'::character varying, 'accepted'::character varying, 'cancelled'::character varying, 'expired'::character varying])::text[])) |
| tenants | 2200_17826_10_not_null | created_at IS NOT NULL |
| tenants | 2200_17826_11_not_null | updated_at IS NOT NULL |
| tenants | 2200_17826_13_not_null | allow_public_registration IS NOT NULL |
| tenants | 2200_17826_14_not_null | public_registration_blocked IS NOT NULL |
| tenants | 2200_17826_16_not_null | public_registration_access_count IS NOT NULL |
| tenants | 2200_17826_17_not_null | public_registration_conversion_count IS NOT NULL |
| tenants | 2200_17826_18_not_null | is_system_tenant IS NOT NULL |
| tenants | 2200_17826_1_not_null | id IS NOT NULL |
| tenants | 2200_17826_2_not_null | org_id IS NOT NULL |
| tenants | 2200_17826_4_not_null | name IS NOT NULL |
| tenants | 2200_17826_5_not_null | slug IS NOT NULL |
| tenants | 2200_17826_6_not_null | plan IS NOT NULL |
| tenants | 2200_17826_7_not_null | features IS NOT NULL |
| tenants | 2200_17826_8_not_null | settings IS NOT NULL |
| tenants | 2200_17826_9_not_null | active IS NOT NULL |
| transaction_allocations | 2200_21867_10_not_null | allocated_amount IS NOT NULL |
| transaction_allocations | 2200_21867_11_not_null | version IS NOT NULL |
| transaction_allocations | 2200_21867_12_not_null | created_at IS NOT NULL |
| transaction_allocations | 2200_21867_13_not_null | updated_at IS NOT NULL |
| transaction_allocations | 2200_21867_1_not_null | id IS NOT NULL |
| transaction_allocations | 2200_21867_2_not_null | tenant_id IS NOT NULL |
| transaction_allocations | 2200_21867_3_not_null | transaction_id IS NOT NULL |
| transaction_allocations | 2200_21867_4_not_null | dimension IS NOT NULL |
| transaction_allocations | 2200_21867_9_not_null | percentage IS NOT NULL |
| transaction_allocations | ck_txalloc_amount_positive | (allocated_amount > (0)::numeric) |
| transaction_allocations | ck_txalloc_dimension_target | (((dimension = 'project'::allocation_dimension) AND (project_id IS NOT NULL) AND (num_nonnulls(artist_id, phonogram_id, release_id) = 0)) OR ((dimension = 'artist'::allocation_dimension) AND (artist_id IS NOT NULL) AND (num_nonnulls(project_id, phonogram_id, release_id) = 0)) OR ((dimension = 'phonogram'::allocation_dimension) AND (phonogram_id IS NOT NULL) AND (num_nonnulls(project_id, artist_id, release_id) = 0)) OR ((dimension = 'release'::allocation_dimension) AND (release_id IS NOT NULL) AND (num_nonnulls(project_id, artist_id, phonogram_id) = 0))) |
| transaction_allocations | ck_txalloc_percentage_range | ((percentage > (0)::numeric) AND (percentage <= (100)::numeric)) |
| transactions | 2200_17966_14_not_null | metadata IS NOT NULL |
| transactions | 2200_17966_15_not_null | created_at IS NOT NULL |
| transactions | 2200_17966_16_not_null | updated_at IS NOT NULL |
| transactions | 2200_17966_1_not_null | id IS NOT NULL |
| transactions | 2200_17966_21_not_null | financial_category_snapshot IS NOT NULL |
| transactions | 2200_17966_2_not_null | tenant_id IS NOT NULL |
| transactions | 2200_17966_3_not_null | tipo IS NOT NULL |
| transactions | 2200_17966_4_not_null | categoria IS NOT NULL |
| transactions | 2200_17966_6_not_null | valor IS NOT NULL |
| transactions | 2200_17966_7_not_null | data IS NOT NULL |
| transactions | 2200_17966_8_not_null | status IS NOT NULL |
| uploads | 2200_18166_12_not_null | status IS NOT NULL |
| uploads | 2200_18166_14_not_null | metadata IS NOT NULL |
| uploads | 2200_18166_15_not_null | created_at IS NOT NULL |
| uploads | 2200_18166_1_not_null | id IS NOT NULL |
| uploads | 2200_18166_2_not_null | tenant_id IS NOT NULL |
| uploads | 2200_18166_3_not_null | user_id IS NOT NULL |
| uploads | 2200_18166_4_not_null | file_id IS NOT NULL |
| uploads | 2200_18166_5_not_null | original_name IS NOT NULL |
| uploads | 2200_18166_6_not_null | mime_type IS NOT NULL |
| uploads | 2200_18166_7_not_null | size_bytes IS NOT NULL |
| uploads | 2200_18166_8_not_null | r2_key IS NOT NULL |
| uploads | 2200_18166_9_not_null | category IS NOT NULL |
| users | 2200_20779_1_not_null | id IS NOT NULL |
| users | 2200_20779_2_not_null | auth_user_id IS NOT NULL |
| users | 2200_20779_5_not_null | created_at IS NOT NULL |
| users | 2200_20779_6_not_null | updated_at IS NOT NULL |
| webhook_events | 2200_18213_10_not_null | retry_count IS NOT NULL |
| webhook_events | 2200_18213_11_not_null | created_at IS NOT NULL |
| webhook_events | 2200_18213_1_not_null | id IS NOT NULL |
| webhook_events | 2200_18213_3_not_null | provider IS NOT NULL |
| webhook_events | 2200_18213_4_not_null | event_type IS NOT NULL |
| webhook_events | 2200_18213_6_not_null | payload IS NOT NULL |
| webhook_events | 2200_18213_7_not_null | status IS NOT NULL |
| work_participants | 2200_22063_10_not_null | updated_at IS NOT NULL |
| work_participants | 2200_22063_1_not_null | id IS NOT NULL |
| work_participants | 2200_22063_2_not_null | tenant_id IS NOT NULL |
| work_participants | 2200_22063_3_not_null | work_id IS NOT NULL |
| work_participants | 2200_22063_4_not_null | nome IS NOT NULL |
| work_participants | 2200_22063_5_not_null | classe_funcao IS NOT NULL |
| work_participants | 2200_22063_8_not_null | ordem IS NOT NULL |
| work_participants | 2200_22063_9_not_null | created_at IS NOT NULL |
| work_participants | chk_work_participants_percentual | ((percentual IS NULL) OR ((percentual >= (0)::numeric) AND (percentual <= (100)::numeric))) |
| workflow_execution_logs | 2200_20278_1_not_null | id IS NOT NULL |
| workflow_execution_logs | 2200_20278_2_not_null | execution_id IS NOT NULL |
| workflow_execution_logs | 2200_20278_3_not_null | action_type IS NOT NULL |
| workflow_execution_logs | 2200_20278_4_not_null | status IS NOT NULL |
| workflow_execution_logs | 2200_20278_7_not_null | created_at IS NOT NULL |
| workflow_executions | 2200_20260_10_not_null | actions_failed IS NOT NULL |
| workflow_executions | 2200_20260_14_not_null | created_at IS NOT NULL |
| workflow_executions | 2200_20260_1_not_null | id IS NOT NULL |
| workflow_executions | 2200_20260_2_not_null | tenant_id IS NOT NULL |
| workflow_executions | 2200_20260_3_not_null | rule_id IS NOT NULL |
| workflow_executions | 2200_20260_4_not_null | rule_name IS NOT NULL |
| workflow_executions | 2200_20260_5_not_null | event_type IS NOT NULL |
| workflow_executions | 2200_20260_7_not_null | status IS NOT NULL |
| workflow_executions | 2200_20260_8_not_null | actions_total IS NOT NULL |
| workflow_executions | 2200_20260_9_not_null | actions_succeeded IS NOT NULL |
| workflow_transitions | 2200_18351_10_not_null | metadata IS NOT NULL |
| workflow_transitions | 2200_18351_11_not_null | created_at IS NOT NULL |
| workflow_transitions | 2200_18351_1_not_null | id IS NOT NULL |
| workflow_transitions | 2200_18351_2_not_null | tenant_id IS NOT NULL |
| workflow_transitions | 2200_18351_3_not_null | entity_type IS NOT NULL |
| workflow_transitions | 2200_18351_4_not_null | entity_id IS NOT NULL |
| workflow_transitions | 2200_18351_5_not_null | from_status IS NOT NULL |
| workflow_transitions | 2200_18351_6_not_null | to_status IS NOT NULL |
| workflow_transitions | 2200_18351_7_not_null | actor_id IS NOT NULL |
| works | 2200_22314_13_not_null | status IS NOT NULL |
| works | 2200_22314_1_not_null | id IS NOT NULL |
| works | 2200_22314_22_not_null | tipo IS NOT NULL |
| works | 2200_22314_2_not_null | tenant_id IS NOT NULL |
| works | 2200_22314_42_not_null | metadata IS NOT NULL |
| works | 2200_22314_43_not_null | created_at IS NOT NULL |
| works | 2200_22314_44_not_null | updated_at IS NOT NULL |
| works | 2200_22314_7_not_null | titulo IS NOT NULL |
| works | chk_works_registry_status | ((registry_status IS NULL) OR ((registry_status)::text = ANY (ARRAY[('DRAFT'::character varying)::text, ('READY_FOR_VALIDATION'::character varying)::text, ('VALIDATED'::character varying)::text, ('READY_TO_SUBMIT'::character varying)::text, ('SUBMITTED'::character varying)::text, ('PROCESSING'::character varying)::text, ('APPROVED'::character varying)::text, ('REJECTED'::character varying)::text, ('REQUIRES_CORRECTION'::character varying)::text, ('FAILED'::character varying)::text, ('ARCHIVED'::character varying)::text]))) |

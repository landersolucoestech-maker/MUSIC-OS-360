> Historical record. Kept as recorded; not the current contract.

# Indexes — Schema `public` (649)

| TABLE | INDEX_NAME | UNIQUE | PRIMARY | METHOD | DEFINITION | PARTIAL_PREDICATE |
|---|---|---|---|---|---|---|
| activity_logs | activity_logs_pkey | true | true | btree | CREATE UNIQUE INDEX activity_logs_pkey ON public.activity_logs USING btree (id) |  |
| activity_logs | idx_activity_logs_entity | false | false | btree | CREATE INDEX idx_activity_logs_entity ON public.activity_logs USING btree (entity_type, entity_id) |  |
| activity_logs | idx_activity_logs_tenant_id | false | false | btree | CREATE INDEX idx_activity_logs_tenant_id ON public.activity_logs USING btree (tenant_id) |  |
| activity_logs | idx_activity_logs_tenant_ts | false | false | btree | CREATE INDEX idx_activity_logs_tenant_ts ON public.activity_logs USING btree (tenant_id, created_at DESC) |  |
| activity_logs | idx_activity_logs_user_id | false | false | btree | CREATE INDEX idx_activity_logs_user_id ON public.activity_logs USING btree (user_id) |  |
| ai_jobs | ai_jobs_pkey | true | true | btree | CREATE UNIQUE INDEX ai_jobs_pkey ON public.ai_jobs USING btree (id) |  |
| ai_jobs | idx_ai_jobs_created_at | false | false | btree | CREATE INDEX idx_ai_jobs_created_at ON public.ai_jobs USING btree (created_at) |  |
| ai_jobs | idx_ai_jobs_tenant_id | false | false | btree | CREATE INDEX idx_ai_jobs_tenant_id ON public.ai_jobs USING btree (tenant_id) |  |
| ai_usage_logs | ai_usage_logs_pkey | true | true | btree | CREATE UNIQUE INDEX ai_usage_logs_pkey ON public.ai_usage_logs USING btree (id) |  |
| ai_usage_logs | idx_ai_usage_job | false | false | btree | CREATE INDEX idx_ai_usage_job ON public.ai_usage_logs USING btree (job_id) |  |
| ai_usage_logs | idx_ai_usage_model | false | false | btree | CREATE INDEX idx_ai_usage_model ON public.ai_usage_logs USING btree (tenant_id, model) |  |
| ai_usage_logs | idx_ai_usage_tenant | false | false | btree | CREATE INDEX idx_ai_usage_tenant ON public.ai_usage_logs USING btree (tenant_id, created_at) |  |
| artist_goals | artist_goals_pkey | true | true | btree | CREATE UNIQUE INDEX artist_goals_pkey ON public.artist_goals USING btree (id) |  |
| artist_goals | idx_artist_goals_artista_id | false | false | btree | CREATE INDEX idx_artist_goals_artista_id ON public.artist_goals USING btree (artista_id) |  |
| artist_goals | idx_artist_goals_tenant_id | false | false | btree | CREATE INDEX idx_artist_goals_tenant_id ON public.artist_goals USING btree (tenant_id) |  |
| artist_platform_profiles | IDX_artist_platform_profiles_tenant_artist | false | false | btree | CREATE INDEX "IDX_artist_platform_profiles_tenant_artist" ON public.artist_platform_profiles USING btree (tenant_id, artist_id) |  |
| artist_platform_profiles | IDX_artist_platform_profiles_tenant_platform | false | false | btree | CREATE INDEX "IDX_artist_platform_profiles_tenant_platform" ON public.artist_platform_profiles USING btree (tenant_id, platform) |  |
| artist_platform_profiles | IDX_artist_platform_profiles_tenant_status | false | false | btree | CREATE INDEX "IDX_artist_platform_profiles_tenant_status" ON public.artist_platform_profiles USING btree (tenant_id, sync_status) |  |
| artist_platform_profiles | UQ_artist_platform_profiles_tenant_artist_platform | true | false | btree | CREATE UNIQUE INDEX "UQ_artist_platform_profiles_tenant_artist_platform" ON public.artist_platform_profiles USING btree (tenant_id, artist_id, platform) |  |
| artist_platform_profiles | artist_platform_profiles_pkey | true | true | btree | CREATE UNIQUE INDEX artist_platform_profiles_pkey ON public.artist_platform_profiles USING btree (id) |  |
| artists | artists_pkey | true | true | btree | CREATE UNIQUE INDEX artists_pkey ON public.artists USING btree (id) |  |
| artists | idx_artists_name_trgm | false | false | gin | CREATE INDEX idx_artists_name_trgm ON public.artists USING gin (nome_artistico gin_trgm_ops) |  |
| artists | idx_artists_status | false | false | btree | CREATE INDEX idx_artists_status ON public.artists USING btree (tenant_id, status) WHERE (deleted_at IS NULL) | (deleted_at IS NULL) |
| artists | idx_artists_tenant_active | false | false | btree | CREATE INDEX idx_artists_tenant_active ON public.artists USING btree (tenant_id, deleted_at, created_at DESC) WHERE (deleted_at IS NULL) | (deleted_at IS NULL) |
| artists | idx_artists_tenant_deleted | false | false | btree | CREATE INDEX idx_artists_tenant_deleted ON public.artists USING btree (tenant_id, deleted_at) |  |
| artists | idx_artists_tenant_id | false | false | btree | CREATE INDEX idx_artists_tenant_id ON public.artists USING btree (tenant_id) |  |
| artists | idx_artists_tenant_status | false | false | btree | CREATE INDEX idx_artists_tenant_status ON public.artists USING btree (tenant_id, status) |  |
| artists | uq_artists_tenant_id_id | true | false | btree | CREATE UNIQUE INDEX uq_artists_tenant_id_id ON public.artists USING btree (tenant_id, id) |  |
| asset_usage_logs | asset_usage_logs_pkey | true | true | btree | CREATE UNIQUE INDEX asset_usage_logs_pkey ON public.asset_usage_logs USING btree (id) |  |
| asset_usage_logs | idx_asset_usage_logs_action | false | false | btree | CREATE INDEX idx_asset_usage_logs_action ON public.asset_usage_logs USING btree (tenant_id, action) |  |
| asset_usage_logs | idx_asset_usage_logs_asset | false | false | btree | CREATE INDEX idx_asset_usage_logs_asset ON public.asset_usage_logs USING btree (tenant_id, asset_id) |  |
| asset_usage_logs | idx_asset_usage_logs_tenant | false | false | btree | CREATE INDEX idx_asset_usage_logs_tenant ON public.asset_usage_logs USING btree (tenant_id) |  |
| asset_versions | asset_versions_pkey | true | true | btree | CREATE UNIQUE INDEX asset_versions_pkey ON public.asset_versions USING btree (id) |  |
| asset_versions | idx_asset_versions_tenant | false | false | btree | CREATE INDEX idx_asset_versions_tenant ON public.asset_versions USING btree (tenant_id) |  |
| asset_versions | uq_asset_versions_asset_version | true | false | btree | CREATE UNIQUE INDEX uq_asset_versions_asset_version ON public.asset_versions USING btree (tenant_id, asset_id, version) |  |
| assets | assets_pkey | true | true | btree | CREATE UNIQUE INDEX assets_pkey ON public.assets USING btree (id) |  |
| assets | idx_assets_tenant | false | false | btree | CREATE INDEX idx_assets_tenant ON public.assets USING btree (tenant_id) |  |
| assets | idx_assets_tenant_source | false | false | btree | CREATE INDEX idx_assets_tenant_source ON public.assets USING btree (tenant_id, source, source_id) |  |
| assets | idx_assets_tenant_status | false | false | btree | CREATE INDEX idx_assets_tenant_status ON public.assets USING btree (tenant_id, status) |  |
| assets | idx_assets_tenant_type | false | false | btree | CREATE INDEX idx_assets_tenant_type ON public.assets USING btree (tenant_id, asset_type) |  |
| audiovisual_approvals | audiovisual_approvals_pkey | true | true | btree | CREATE UNIQUE INDEX audiovisual_approvals_pkey ON public.audiovisual_approvals USING btree (id) |  |
| audiovisual_approvals | idx_av_approvals_deliverable | false | false | btree | CREATE INDEX idx_av_approvals_deliverable ON public.audiovisual_approvals USING btree (tenant_id, deliverable_id) |  |
| audiovisual_approvals | idx_av_approvals_project | false | false | btree | CREATE INDEX idx_av_approvals_project ON public.audiovisual_approvals USING btree (tenant_id, audiovisual_project_id, requested_at DESC) |  |
| audiovisual_approvals | idx_av_approvals_status | false | false | btree | CREATE INDEX idx_av_approvals_status ON public.audiovisual_approvals USING btree (tenant_id, status) |  |
| audiovisual_approvals | idx_av_approvals_tenant | false | false | btree | CREATE INDEX idx_av_approvals_tenant ON public.audiovisual_approvals USING btree (tenant_id) |  |
| audiovisual_assets | audiovisual_assets_pkey | true | true | btree | CREATE UNIQUE INDEX audiovisual_assets_pkey ON public.audiovisual_assets USING btree (id) |  |
| audiovisual_assets | idx_av_assets_deleted | false | false | btree | CREATE INDEX idx_av_assets_deleted ON public.audiovisual_assets USING btree (tenant_id, deleted_at) |  |
| audiovisual_assets | idx_av_assets_kind | false | false | btree | CREATE INDEX idx_av_assets_kind ON public.audiovisual_assets USING btree (tenant_id, kind) |  |
| audiovisual_assets | idx_av_assets_project | false | false | btree | CREATE INDEX idx_av_assets_project ON public.audiovisual_assets USING btree (tenant_id, audiovisual_project_id, created_at DESC) |  |
| audiovisual_assets | idx_av_assets_tenant | false | false | btree | CREATE INDEX idx_av_assets_tenant ON public.audiovisual_assets USING btree (tenant_id) |  |
| audiovisual_briefings | audiovisual_briefings_audiovisual_project_id_key | true | false | btree | CREATE UNIQUE INDEX audiovisual_briefings_audiovisual_project_id_key ON public.audiovisual_briefings USING btree (audiovisual_project_id) |  |
| audiovisual_briefings | audiovisual_briefings_pkey | true | true | btree | CREATE UNIQUE INDEX audiovisual_briefings_pkey ON public.audiovisual_briefings USING btree (id) |  |
| audiovisual_briefings | idx_av_briefings_project | false | false | btree | CREATE INDEX idx_av_briefings_project ON public.audiovisual_briefings USING btree (tenant_id, audiovisual_project_id) |  |
| audiovisual_briefings | idx_av_briefings_tenant | false | false | btree | CREATE INDEX idx_av_briefings_tenant ON public.audiovisual_briefings USING btree (tenant_id) |  |
| audiovisual_deliverables | audiovisual_deliverables_pkey | true | true | btree | CREATE UNIQUE INDEX audiovisual_deliverables_pkey ON public.audiovisual_deliverables USING btree (id) |  |
| audiovisual_deliverables | idx_av_deliverables_deleted | false | false | btree | CREATE INDEX idx_av_deliverables_deleted ON public.audiovisual_deliverables USING btree (tenant_id, deleted_at) |  |
| audiovisual_deliverables | idx_av_deliverables_project | false | false | btree | CREATE INDEX idx_av_deliverables_project ON public.audiovisual_deliverables USING btree (tenant_id, audiovisual_project_id) |  |
| audiovisual_deliverables | idx_av_deliverables_status | false | false | btree | CREATE INDEX idx_av_deliverables_status ON public.audiovisual_deliverables USING btree (tenant_id, status) |  |
| audiovisual_deliverables | idx_av_deliverables_tenant | false | false | btree | CREATE INDEX idx_av_deliverables_tenant ON public.audiovisual_deliverables USING btree (tenant_id) |  |
| audiovisual_production_days | audiovisual_production_days_pkey | true | true | btree | CREATE UNIQUE INDEX audiovisual_production_days_pkey ON public.audiovisual_production_days USING btree (id) |  |
| audiovisual_production_days | idx_av_pdays_project | false | false | btree | CREATE INDEX idx_av_pdays_project ON public.audiovisual_production_days USING btree (tenant_id, audiovisual_project_id, shooting_date) |  |
| audiovisual_production_days | idx_av_pdays_tenant | false | false | btree | CREATE INDEX idx_av_pdays_tenant ON public.audiovisual_production_days USING btree (tenant_id) |  |
| audiovisual_projects | audiovisual_projects_pkey | true | true | btree | CREATE UNIQUE INDEX audiovisual_projects_pkey ON public.audiovisual_projects USING btree (id) |  |
| audiovisual_projects | idx_audiovisual_projects_financial_project | false | false | btree | CREATE INDEX idx_audiovisual_projects_financial_project ON public.audiovisual_projects USING btree (tenant_id, financial_project_id) |  |
| audiovisual_projects | idx_av_projects_publish_date | false | false | btree | CREATE INDEX idx_av_projects_publish_date ON public.audiovisual_projects USING btree (tenant_id, publish_date) |  |
| audiovisual_projects | idx_av_projects_tenant | false | false | btree | CREATE INDEX idx_av_projects_tenant ON public.audiovisual_projects USING btree (tenant_id) |  |
| audiovisual_projects | idx_av_projects_tenant_artist | false | false | btree | CREATE INDEX idx_av_projects_tenant_artist ON public.audiovisual_projects USING btree (tenant_id, artist_id) |  |
| audiovisual_projects | idx_av_projects_tenant_campaign | false | false | btree | CREATE INDEX idx_av_projects_tenant_campaign ON public.audiovisual_projects USING btree (tenant_id, campaign_id) |  |
| audiovisual_projects | idx_av_projects_tenant_deleted | false | false | btree | CREATE INDEX idx_av_projects_tenant_deleted ON public.audiovisual_projects USING btree (tenant_id, deleted_at) |  |
| audiovisual_projects | idx_av_projects_tenant_event | false | false | btree | CREATE INDEX idx_av_projects_tenant_event ON public.audiovisual_projects USING btree (tenant_id, event_id) |  |
| audiovisual_projects | idx_av_projects_tenant_release | false | false | btree | CREATE INDEX idx_av_projects_tenant_release ON public.audiovisual_projects USING btree (tenant_id, release_id) |  |
| audiovisual_projects | idx_av_projects_tenant_status | false | false | btree | CREATE INDEX idx_av_projects_tenant_status ON public.audiovisual_projects USING btree (tenant_id, status) |  |
| audiovisual_projects | idx_av_projects_tenant_type | false | false | btree | CREATE INDEX idx_av_projects_tenant_type ON public.audiovisual_projects USING btree (tenant_id, type) |  |
| audiovisual_shots | audiovisual_shots_pkey | true | true | btree | CREATE UNIQUE INDEX audiovisual_shots_pkey ON public.audiovisual_shots USING btree (id) |  |
| audiovisual_shots | idx_av_shots_project | false | false | btree | CREATE INDEX idx_av_shots_project ON public.audiovisual_shots USING btree (tenant_id, audiovisual_project_id, ordering) |  |
| audiovisual_shots | idx_av_shots_tenant | false | false | btree | CREATE INDEX idx_av_shots_tenant ON public.audiovisual_shots USING btree (tenant_id) |  |
| audiovisual_tasks | audiovisual_tasks_pkey | true | true | btree | CREATE UNIQUE INDEX audiovisual_tasks_pkey ON public.audiovisual_tasks USING btree (id) |  |
| audiovisual_tasks | idx_av_tasks_assigned | false | false | btree | CREATE INDEX idx_av_tasks_assigned ON public.audiovisual_tasks USING btree (tenant_id, assigned_to) |  |
| audiovisual_tasks | idx_av_tasks_deleted | false | false | btree | CREATE INDEX idx_av_tasks_deleted ON public.audiovisual_tasks USING btree (tenant_id, deleted_at) |  |
| audiovisual_tasks | idx_av_tasks_due | false | false | btree | CREATE INDEX idx_av_tasks_due ON public.audiovisual_tasks USING btree (tenant_id, due_date) |  |
| audiovisual_tasks | idx_av_tasks_project | false | false | btree | CREATE INDEX idx_av_tasks_project ON public.audiovisual_tasks USING btree (tenant_id, audiovisual_project_id, status) |  |
| audiovisual_tasks | idx_av_tasks_tenant | false | false | btree | CREATE INDEX idx_av_tasks_tenant ON public.audiovisual_tasks USING btree (tenant_id) |  |
| audiovisual_team_members | audiovisual_team_members_pkey | true | true | btree | CREATE UNIQUE INDEX audiovisual_team_members_pkey ON public.audiovisual_team_members USING btree (id) |  |
| audiovisual_team_members | idx_av_team_project | false | false | btree | CREATE INDEX idx_av_team_project ON public.audiovisual_team_members USING btree (tenant_id, audiovisual_project_id) |  |
| audiovisual_team_members | idx_av_team_tenant | false | false | btree | CREATE INDEX idx_av_team_tenant ON public.audiovisual_team_members USING btree (tenant_id) |  |
| audiovisual_team_members | idx_av_team_user | false | false | btree | CREATE INDEX idx_av_team_user ON public.audiovisual_team_members USING btree (tenant_id, user_id) |  |
| audit_logs | audit_logs_pkey | true | true | btree | CREATE UNIQUE INDEX audit_logs_pkey ON public.audit_logs USING btree (id) |  |
| audit_logs | idx_audit_logs_correlation_id | false | false | btree | CREATE INDEX idx_audit_logs_correlation_id ON public.audit_logs USING btree (correlation_id) |  |
| audit_logs | idx_audit_logs_created | false | false | btree | CREATE INDEX idx_audit_logs_created ON public.audit_logs USING btree (created_at) |  |
| audit_logs | idx_audit_logs_entity | false | false | btree | CREATE INDEX idx_audit_logs_entity ON public.audit_logs USING btree (tenant_id, entity) |  |
| audit_logs | idx_audit_logs_tenant_entity_id | false | false | btree | CREATE INDEX idx_audit_logs_tenant_entity_id ON public.audit_logs USING btree (tenant_id, entity, entity_id) |  |
| audit_logs | idx_audit_logs_tenant_id | false | false | btree | CREATE INDEX idx_audit_logs_tenant_id ON public.audit_logs USING btree (tenant_id) |  |
| audit_logs | idx_audit_logs_tenant_ts | false | false | btree | CREATE INDEX idx_audit_logs_tenant_ts ON public.audit_logs USING btree (tenant_id, created_at DESC) |  |
| audit_logs | idx_audit_logs_user_id | false | false | btree | CREATE INDEX idx_audit_logs_user_id ON public.audit_logs USING btree (user_id) |  |
| billing_plans | billing_plans_pkey | true | true | btree | CREATE UNIQUE INDEX billing_plans_pkey ON public.billing_plans USING btree (id) |  |
| billing_plans | billing_plans_slug_key | true | false | btree | CREATE UNIQUE INDEX billing_plans_slug_key ON public.billing_plans USING btree (slug) |  |
| billing_plans | idx_billing_plans_active | false | false | btree | CREATE INDEX idx_billing_plans_active ON public.billing_plans USING btree (active) |  |
| billing_settings | billing_settings_key_key | true | false | btree | CREATE UNIQUE INDEX billing_settings_key_key ON public.billing_settings USING btree (key) |  |
| billing_settings | billing_settings_pkey | true | true | btree | CREATE UNIQUE INDEX billing_settings_pkey ON public.billing_settings USING btree (id) |  |
| billing_subscriptions | billing_subscriptions_pkey | true | true | btree | CREATE UNIQUE INDEX billing_subscriptions_pkey ON public.billing_subscriptions USING btree (id) |  |
| billing_subscriptions | billing_subscriptions_stripe_customer_id_key | true | false | btree | CREATE UNIQUE INDEX billing_subscriptions_stripe_customer_id_key ON public.billing_subscriptions USING btree (stripe_customer_id) |  |
| billing_subscriptions | billing_subscriptions_stripe_sub_id_key | true | false | btree | CREATE UNIQUE INDEX billing_subscriptions_stripe_sub_id_key ON public.billing_subscriptions USING btree (stripe_sub_id) |  |
| billing_subscriptions | idx_billing_org_id | false | false | btree | CREATE INDEX idx_billing_org_id ON public.billing_subscriptions USING btree (org_id) |  |
| billing_subscriptions | idx_billing_subs_org | false | false | btree | CREATE INDEX idx_billing_subs_org ON public.billing_subscriptions USING btree (org_id) |  |
| billing_subscriptions | idx_billing_subs_stripe_customer | false | false | btree | CREATE INDEX idx_billing_subs_stripe_customer ON public.billing_subscriptions USING btree (stripe_customer_id) |  |
| billing_subscriptions | idx_billing_subscriptions_status | false | false | btree | CREATE INDEX idx_billing_subscriptions_status ON public.billing_subscriptions USING btree (status) |  |
| billing_subscriptions | uq_billing_subscriptions_stripe_subscription | true | false | btree | CREATE UNIQUE INDEX uq_billing_subscriptions_stripe_subscription ON public.billing_subscriptions USING btree (stripe_subscription_id) WHERE (stripe_subscription_id IS NOT NULL) | (stripe_subscription_id IS NOT NULL) |
| billing_subscriptions | uq_billing_subscriptions_tenant | true | false | btree | CREATE UNIQUE INDEX uq_billing_subscriptions_tenant ON public.billing_subscriptions USING btree (tenant_id) WHERE (tenant_id IS NOT NULL) | (tenant_id IS NOT NULL) |
| briefings | briefings_pkey | true | true | btree | CREATE UNIQUE INDEX briefings_pkey ON public.briefings USING btree (id) |  |
| briefings | idx_briefings_campanha_id | false | false | btree | CREATE INDEX idx_briefings_campanha_id ON public.briefings USING btree (campanha_id) |  |
| briefings | idx_briefings_tenant_active | false | false | btree | CREATE INDEX idx_briefings_tenant_active ON public.briefings USING btree (tenant_id, deleted_at, created_at DESC) WHERE (deleted_at IS NULL) | (deleted_at IS NULL) |
| briefings | idx_briefings_tenant_id | false | false | btree | CREATE INDEX idx_briefings_tenant_id ON public.briefings USING btree (tenant_id) |  |
| budget_revisions | budget_revisions_pkey | true | true | btree | CREATE UNIQUE INDEX budget_revisions_pkey ON public.budget_revisions USING btree (id) |  |
| budget_revisions | idx_budget_revisions_tenant_budget | false | false | btree | CREATE INDEX idx_budget_revisions_tenant_budget ON public.budget_revisions USING btree (tenant_id, budget_id) |  |
| budget_revisions | uq_budget_revisions_tenant_id_id | true | false | btree | CREATE UNIQUE INDEX uq_budget_revisions_tenant_id_id ON public.budget_revisions USING btree (tenant_id, id) |  |
| budgets | budgets_pkey | true | true | btree | CREATE UNIQUE INDEX budgets_pkey ON public.budgets USING btree (id) |  |
| budgets | uq_budgets_active_per_project | true | false | btree | CREATE UNIQUE INDEX uq_budgets_active_per_project ON public.budgets USING btree (tenant_id, project_id) WHERE (is_active AND (deleted_at IS NULL)) | (is_active AND (deleted_at IS NULL)) |
| budgets | uq_budgets_tenant_id_id | true | false | btree | CREATE UNIQUE INDEX uq_budgets_tenant_id_id ON public.budgets USING btree (tenant_id, id) |  |
| campaign_assets | campaign_assets_pkey | true | true | btree | CREATE UNIQUE INDEX campaign_assets_pkey ON public.campaign_assets USING btree (id) |  |
| campaign_assets | idx_campaign_assets_campaign | false | false | btree | CREATE INDEX idx_campaign_assets_campaign ON public.campaign_assets USING btree (tenant_id, campaign_id) |  |
| campaign_tasks | campaign_tasks_pkey | true | true | btree | CREATE UNIQUE INDEX campaign_tasks_pkey ON public.campaign_tasks USING btree (id) |  |
| campaign_tasks | idx_campaign_tasks_assignee | false | false | btree | CREATE INDEX idx_campaign_tasks_assignee ON public.campaign_tasks USING btree (assigned_to) |  |
| campaign_tasks | idx_campaign_tasks_campaign | false | false | btree | CREATE INDEX idx_campaign_tasks_campaign ON public.campaign_tasks USING btree (tenant_id, campaign_id) |  |
| campaign_tasks | idx_campaign_tasks_due | false | false | btree | CREATE INDEX idx_campaign_tasks_due ON public.campaign_tasks USING btree (tenant_id, due_date) |  |
| campaigns | campaigns_pkey | true | true | btree | CREATE UNIQUE INDEX campaigns_pkey ON public.campaigns USING btree (id) |  |
| campaigns | idx_campaigns_tenant_active | false | false | btree | CREATE INDEX idx_campaigns_tenant_active ON public.campaigns USING btree (tenant_id, deleted_at, created_at DESC) WHERE (deleted_at IS NULL) | (deleted_at IS NULL) |
| campaigns | idx_campaigns_tenant_id | false | false | btree | CREATE INDEX idx_campaigns_tenant_id ON public.campaigns USING btree (tenant_id) |  |
| campaigns | ux_campaigns_id_tenant | true | false | btree | CREATE UNIQUE INDEX ux_campaigns_id_tenant ON public.campaigns USING btree (id, tenant_id) |  |
| client_attachments | client_attachments_pkey | true | true | btree | CREATE UNIQUE INDEX client_attachments_pkey ON public.client_attachments USING btree (id) |  |
| client_attachments | idx_client_attachments_client_id | false | false | btree | CREATE INDEX idx_client_attachments_client_id ON public.client_attachments USING btree (tenant_id, client_id) WHERE (deleted_at IS NULL) | (deleted_at IS NULL) |
| client_attachments | idx_client_attachments_tenant_id | false | false | btree | CREATE INDEX idx_client_attachments_tenant_id ON public.client_attachments USING btree (tenant_id) |  |
| clients | clients_pkey | true | true | btree | CREATE UNIQUE INDEX clients_pkey ON public.clients USING btree (id) |  |
| clients | idx_clients_tenant_active | false | false | btree | CREATE INDEX idx_clients_tenant_active ON public.clients USING btree (tenant_id, deleted_at, created_at DESC) WHERE (deleted_at IS NULL) | (deleted_at IS NULL) |
| clients | idx_clients_tenant_id | false | false | btree | CREATE INDEX idx_clients_tenant_id ON public.clients USING btree (tenant_id) |  |
| clients | idx_clients_tenant_status | false | false | btree | CREATE INDEX idx_clients_tenant_status ON public.clients USING btree (tenant_id, status) |  |
| clients | uq_clients_tenant_id_id | true | false | btree | CREATE UNIQUE INDEX uq_clients_tenant_id_id ON public.clients USING btree (tenant_id, id) |  |
| content_detections | content_detections_pkey | true | true | btree | CREATE UNIQUE INDEX content_detections_pkey ON public.content_detections USING btree (id) |  |
| content_detections | idx_content_detections_status | false | false | btree | CREATE INDEX idx_content_detections_status ON public.content_detections USING btree (status) |  |
| content_detections | idx_content_detections_tenant | false | false | btree | CREATE INDEX idx_content_detections_tenant ON public.content_detections USING btree (tenant_id) |  |
| contract_service_types | contract_service_types_pkey | true | true | btree | CREATE UNIQUE INDEX contract_service_types_pkey ON public.contract_service_types USING btree (id) |  |
| contract_service_types | idx_contract_service_types_tenant_active | false | false | btree | CREATE INDEX idx_contract_service_types_tenant_active ON public.contract_service_types USING btree (tenant_id, active, sort_order) |  |
| contract_service_types | uq_contract_service_types_tenant_slug | true | false | btree | CREATE UNIQUE INDEX uq_contract_service_types_tenant_slug ON public.contract_service_types USING btree (tenant_id, slug) WHERE (deleted_at IS NULL) | (deleted_at IS NULL) |
| contract_templates | contract_templates_pkey | true | true | btree | CREATE UNIQUE INDEX contract_templates_pkey ON public.contract_templates USING btree (id) |  |
| contract_templates | idx_contract_templates_tenant | false | false | btree | CREATE INDEX idx_contract_templates_tenant ON public.contract_templates USING btree (tenant_id) |  |
| contract_templates | idx_contract_templates_tenant_active | false | false | btree | CREATE INDEX idx_contract_templates_tenant_active ON public.contract_templates USING btree (tenant_id, deleted_at, created_at DESC) WHERE (deleted_at IS NULL) | (deleted_at IS NULL) |
| contracts | contracts_pkey | true | true | btree | CREATE UNIQUE INDEX contracts_pkey ON public.contracts USING btree (id) |  |
| contracts | idx_contracts_artista_id | false | false | btree | CREATE INDEX idx_contracts_artista_id ON public.contracts USING btree (artista_id) |  |
| contracts | idx_contracts_data_fim | false | false | btree | CREATE INDEX idx_contracts_data_fim ON public.contracts USING btree (data_fim) |  |
| contracts | idx_contracts_status | false | false | btree | CREATE INDEX idx_contracts_status ON public.contracts USING btree (tenant_id, status) WHERE (deleted_at IS NULL) | (deleted_at IS NULL) |
| contracts | idx_contracts_tenant_active | false | false | btree | CREATE INDEX idx_contracts_tenant_active ON public.contracts USING btree (tenant_id, deleted_at, created_at DESC) WHERE (deleted_at IS NULL) | (deleted_at IS NULL) |
| contracts | idx_contracts_tenant_id | false | false | btree | CREATE INDEX idx_contracts_tenant_id ON public.contracts USING btree (tenant_id) |  |
| contracts | idx_contracts_tenant_status | false | false | btree | CREATE INDEX idx_contracts_tenant_status ON public.contracts USING btree (tenant_id, status) |  |
| contracts | uq_contracts_tenant_id_id | true | false | btree | CREATE UNIQUE INDEX uq_contracts_tenant_id_id ON public.contracts USING btree (tenant_id, id) |  |
| contracts | ux_contracts_id_tenant | true | false | btree | CREATE UNIQUE INDEX ux_contracts_id_tenant ON public.contracts USING btree (id, tenant_id) |  |
| conversation_messages | conversation_messages_pkey | true | true | btree | CREATE UNIQUE INDEX conversation_messages_pkey ON public.conversation_messages USING btree (id) |  |
| conversation_messages | idx_conv_messages_conv | false | false | btree | CREATE INDEX idx_conv_messages_conv ON public.conversation_messages USING btree (conversation_id, created_at DESC) |  |
| conversation_messages | idx_conv_messages_tenant | false | false | btree | CREATE INDEX idx_conv_messages_tenant ON public.conversation_messages USING btree (tenant_id) |  |
| conversation_notes | conversation_notes_pkey | true | true | btree | CREATE UNIQUE INDEX conversation_notes_pkey ON public.conversation_notes USING btree (id) |  |
| conversation_notes | idx_conv_notes_conv | false | false | btree | CREATE INDEX idx_conv_notes_conv ON public.conversation_notes USING btree (conversation_id, created_at DESC) |  |
| conversations | conversations_pkey | true | true | btree | CREATE UNIQUE INDEX conversations_pkey ON public.conversations USING btree (id) |  |
| conversations | idx_conversations_assigned | false | false | btree | CREATE INDEX idx_conversations_assigned ON public.conversations USING btree (assigned_to) WHERE (deleted_at IS NULL) | (deleted_at IS NULL) |
| conversations | idx_conversations_contact | false | false | btree | CREATE INDEX idx_conversations_contact ON public.conversations USING btree (contact_id) WHERE (deleted_at IS NULL) | (deleted_at IS NULL) |
| conversations | idx_conversations_tenant_status | false | false | btree | CREATE INDEX idx_conversations_tenant_status ON public.conversations USING btree (tenant_id, status) WHERE (deleted_at IS NULL) | (deleted_at IS NULL) |
| cost_centers | cost_centers_pkey | true | true | btree | CREATE UNIQUE INDEX cost_centers_pkey ON public.cost_centers USING btree (id) |  |
| cost_centers | uq_cost_centers_tenant_id_id | true | false | btree | CREATE UNIQUE INDEX uq_cost_centers_tenant_id_id ON public.cost_centers USING btree (tenant_id, id) |  |
| cost_centers | uq_cost_centers_tenant_name | true | false | btree | CREATE UNIQUE INDEX uq_cost_centers_tenant_name ON public.cost_centers USING btree (tenant_id, name) WHERE (deleted_at IS NULL) | (deleted_at IS NULL) |
| counterparties | counterparties_pkey | true | true | btree | CREATE UNIQUE INDEX counterparties_pkey ON public.counterparties USING btree (id) |  |
| counterparties | uq_counterparties_tenant_id_id | true | false | btree | CREATE UNIQUE INDEX uq_counterparties_tenant_id_id ON public.counterparties USING btree (tenant_id, id) |  |
| counterparties | uq_counterparties_tenant_name | true | false | btree | CREATE UNIQUE INDEX uq_counterparties_tenant_name ON public.counterparties USING btree (tenant_id, name) WHERE (deleted_at IS NULL) | (deleted_at IS NULL) |
| departments | departments_pkey | true | true | btree | CREATE UNIQUE INDEX departments_pkey ON public.departments USING btree (id) |  |
| departments | idx_departments_parent | false | false | btree | CREATE INDEX idx_departments_parent ON public.departments USING btree (parent_department_id) |  |
| departments | idx_departments_tenant_id | false | false | btree | CREATE INDEX idx_departments_tenant_id ON public.departments USING btree (tenant_id) |  |
| departments | uq_departments_tenant_slug | true | false | btree | CREATE UNIQUE INDEX uq_departments_tenant_slug ON public.departments USING btree (tenant_id, slug) WHERE (deleted_at IS NULL) | (deleted_at IS NULL) |
| domain_event_log | IDX_del_aggregate | false | false | btree | CREATE INDEX "IDX_del_aggregate" ON public.domain_event_log USING btree (aggregate_type, aggregate_id) |  |
| domain_event_log | IDX_del_correlation_id | false | false | btree | CREATE INDEX "IDX_del_correlation_id" ON public.domain_event_log USING btree (correlation_id) |  |
| domain_event_log | IDX_del_occurred_at | false | false | btree | CREATE INDEX "IDX_del_occurred_at" ON public.domain_event_log USING btree (occurred_at DESC) |  |
| domain_event_log | IDX_del_tenant_event_type | false | false | btree | CREATE INDEX "IDX_del_tenant_event_type" ON public.domain_event_log USING btree (tenant_id, event_type) |  |
| domain_event_log | IDX_del_tenant_id | false | false | btree | CREATE INDEX "IDX_del_tenant_id" ON public.domain_event_log USING btree (tenant_id) |  |
| domain_event_log | domain_event_log_pkey | true | true | btree | CREATE UNIQUE INDEX domain_event_log_pkey ON public.domain_event_log USING btree (id) |  |
| domain_event_log | idx_domain_event_log_aggregate | false | false | btree | CREATE INDEX idx_domain_event_log_aggregate ON public.domain_event_log USING btree (aggregate_type, aggregate_id, created_at DESC) |  |
| ecad_reports | ecad_reports_pkey | true | true | btree | CREATE UNIQUE INDEX ecad_reports_pkey ON public.ecad_reports USING btree (id) |  |
| ecad_reports | idx_ecad_reports_periodo | false | false | btree | CREATE INDEX idx_ecad_reports_periodo ON public.ecad_reports USING btree (periodo) |  |
| ecad_reports | idx_ecad_reports_tenant | false | false | btree | CREATE INDEX idx_ecad_reports_tenant ON public.ecad_reports USING btree (tenant_id) |  |
| employees | employees_pkey | true | true | btree | CREATE UNIQUE INDEX employees_pkey ON public.employees USING btree (id) |  |
| employees | idx_employees_status | false | false | btree | CREATE INDEX idx_employees_status ON public.employees USING btree (status) |  |
| employees | idx_employees_tenant_id | false | false | btree | CREATE INDEX idx_employees_tenant_id ON public.employees USING btree (tenant_id) |  |
| events | events_pkey | true | true | btree | CREATE UNIQUE INDEX events_pkey ON public.events USING btree (id) |  |
| events | idx_events_tenant_active | false | false | btree | CREATE INDEX idx_events_tenant_active ON public.events USING btree (tenant_id, deleted_at, created_at DESC) WHERE (deleted_at IS NULL) | (deleted_at IS NULL) |
| events | idx_events_tenant_data | false | false | btree | CREATE INDEX idx_events_tenant_data ON public.events USING btree (tenant_id, data) |  |
| events | idx_events_tenant_id | false | false | btree | CREATE INDEX idx_events_tenant_id ON public.events USING btree (tenant_id) |  |
| events | idx_events_tenant_starts_at | false | false | btree | CREATE INDEX idx_events_tenant_starts_at ON public.events USING btree (tenant_id, starts_at) |  |
| events | uq_events_tenant_id_id | true | false | btree | CREATE UNIQUE INDEX uq_events_tenant_id_id ON public.events USING btree (tenant_id, id) |  |
| external_identifiers | external_identifiers_pkey | true | true | btree | CREATE UNIQUE INDEX external_identifiers_pkey ON public.external_identifiers USING btree (id) |  |
| external_identifiers | idx_ext_id_entity | false | false | btree | CREATE INDEX idx_ext_id_entity ON public.external_identifiers USING btree (tenant_id, entity_type, entity_id) |  |
| external_identifiers | idx_ext_id_tenant | false | false | btree | CREATE INDEX idx_ext_id_tenant ON public.external_identifiers USING btree (tenant_id) |  |
| external_identifiers | idx_ext_id_type | false | false | btree | CREATE INDEX idx_ext_id_type ON public.external_identifiers USING btree (tenant_id, identifier_type) |  |
| external_identifiers | uq_ext_id_entity_value | true | false | btree | CREATE UNIQUE INDEX uq_ext_id_entity_value ON public.external_identifiers USING btree (tenant_id, entity_type, entity_id, identifier_type, identifier_value) |  |
| external_identifiers | uq_ext_id_isrc | true | false | btree | CREATE UNIQUE INDEX uq_ext_id_isrc ON public.external_identifiers USING btree (tenant_id, identifier_value) WHERE ((identifier_type)::text = 'ISRC'::text) | ((identifier_type)::text = 'ISRC'::text) |
| financial_accounts | financial_accounts_pkey | true | true | btree | CREATE UNIQUE INDEX financial_accounts_pkey ON public.financial_accounts USING btree (id) |  |
| financial_accounts | uq_financial_accounts_tenant_id_id | true | false | btree | CREATE UNIQUE INDEX uq_financial_accounts_tenant_id_id ON public.financial_accounts USING btree (tenant_id, id) |  |
| financial_accounts | uq_financial_accounts_tenant_name | true | false | btree | CREATE UNIQUE INDEX uq_financial_accounts_tenant_name ON public.financial_accounts USING btree (tenant_id, name) WHERE (deleted_at IS NULL) | (deleted_at IS NULL) |
| financial_categories | financial_categories_pkey | true | true | btree | CREATE UNIQUE INDEX financial_categories_pkey ON public.financial_categories USING btree (id) |  |
| financial_categories | idx_financial_categories_tenant_active | false | false | btree | CREATE INDEX idx_financial_categories_tenant_active ON public.financial_categories USING btree (tenant_id, is_active) |  |
| financial_categories | idx_financial_categories_tenant_parent | false | false | btree | CREATE INDEX idx_financial_categories_tenant_parent ON public.financial_categories USING btree (tenant_id, parent_id) |  |
| financial_categories | uq_financial_categories_tenant_id_id | true | false | btree | CREATE UNIQUE INDEX uq_financial_categories_tenant_id_id ON public.financial_categories USING btree (tenant_id, id) |  |
| financial_categories | uq_financial_categories_tenant_parent_name | true | false | btree | CREATE UNIQUE INDEX uq_financial_categories_tenant_parent_name ON public.financial_categories USING btree (tenant_id, parent_id, name) NULLS NOT DISTINCT |  |
| financial_category_audit_logs | financial_category_audit_logs_pkey | true | true | btree | CREATE UNIQUE INDEX financial_category_audit_logs_pkey ON public.financial_category_audit_logs USING btree (id) |  |
| financial_category_audit_logs | idx_financial_category_audit_action | false | false | btree | CREATE INDEX idx_financial_category_audit_action ON public.financial_category_audit_logs USING btree (tenant_id, action, "timestamp" DESC) |  |
| financial_category_audit_logs | idx_financial_category_audit_category | false | false | btree | CREATE INDEX idx_financial_category_audit_category ON public.financial_category_audit_logs USING btree (tenant_id, category_id, "timestamp" DESC) |  |
| financial_category_templates | financial_category_templates_pkey | true | true | btree | CREATE UNIQUE INDEX financial_category_templates_pkey ON public.financial_category_templates USING btree (id) |  |
| financial_category_templates | uq_fincat_templates_parent_name | true | false | btree | CREATE UNIQUE INDEX uq_fincat_templates_parent_name ON public.financial_category_templates USING btree (parent_id, name) NULLS NOT DISTINCT |  |
| financial_rules | financial_rules_pkey | true | true | btree | CREATE UNIQUE INDEX financial_rules_pkey ON public.financial_rules USING btree (id) |  |
| financial_rules | idx_financial_rules_tenant | false | false | btree | CREATE INDEX idx_financial_rules_tenant ON public.financial_rules USING btree (tenant_id) |  |
| financial_rules | idx_financial_rules_tenant_ativo | false | false | btree | CREATE INDEX idx_financial_rules_tenant_ativo ON public.financial_rules USING btree (tenant_id, ativo) |  |
| financial_rules | idx_financial_rules_tenant_deleted | false | false | btree | CREATE INDEX idx_financial_rules_tenant_deleted ON public.financial_rules USING btree (tenant_id, deleted_at) |  |
| financial_rules | idx_financial_rules_tenant_tipo | false | false | btree | CREATE INDEX idx_financial_rules_tenant_tipo ON public.financial_rules USING btree (tenant_id, tipo) |  |
| financial_transactions | financial_transactions_pkey | true | true | btree | CREATE UNIQUE INDEX financial_transactions_pkey ON public.financial_transactions USING btree (id) |  |
| financial_transactions | idx_fintx_installment_group | false | false | btree | CREATE INDEX idx_fintx_installment_group ON public.financial_transactions USING btree (tenant_id, installment_group_id) |  |
| financial_transactions | idx_fintx_tenant_account | false | false | btree | CREATE INDEX idx_fintx_tenant_account ON public.financial_transactions USING btree (tenant_id, account_id) |  |
| financial_transactions | idx_fintx_tenant_category | false | false | btree | CREATE INDEX idx_fintx_tenant_category ON public.financial_transactions USING btree (tenant_id, category_id) |  |
| financial_transactions | idx_fintx_tenant_competence | false | false | btree | CREATE INDEX idx_fintx_tenant_competence ON public.financial_transactions USING btree (tenant_id, competence_date) |  |
| financial_transactions | idx_fintx_tenant_cost_center | false | false | btree | CREATE INDEX idx_fintx_tenant_cost_center ON public.financial_transactions USING btree (tenant_id, cost_center_id) |  |
| financial_transactions | idx_fintx_tenant_counterparty | false | false | btree | CREATE INDEX idx_fintx_tenant_counterparty ON public.financial_transactions USING btree (tenant_id, counterparty_id) |  |
| financial_transactions | idx_fintx_tenant_due_pending | false | false | btree | CREATE INDEX idx_fintx_tenant_due_pending ON public.financial_transactions USING btree (tenant_id, due_date) WHERE (status = 'pending'::transaction_status) | (status = 'pending'::transaction_status) |
| financial_transactions | idx_fintx_tenant_live | false | false | btree | CREATE INDEX idx_fintx_tenant_live ON public.financial_transactions USING btree (tenant_id) WHERE (deleted_at IS NULL) | (deleted_at IS NULL) |
| financial_transactions | idx_fintx_tenant_settlement | false | false | btree | CREATE INDEX idx_fintx_tenant_settlement ON public.financial_transactions USING btree (tenant_id, settlement_date) |  |
| financial_transactions | idx_fintx_tenant_status | false | false | btree | CREATE INDEX idx_fintx_tenant_status ON public.financial_transactions USING btree (tenant_id, status) |  |
| financial_transactions | uq_financial_transactions_tenant_id_id | true | false | btree | CREATE UNIQUE INDEX uq_financial_transactions_tenant_id_id ON public.financial_transactions USING btree (tenant_id, id) |  |
| financial_transactions | uq_fintx_single_reversal | true | false | btree | CREATE UNIQUE INDEX uq_fintx_single_reversal ON public.financial_transactions USING btree (tenant_id, reversal_of_id) |  |
| form_submissions | form_submissions_pkey | true | true | btree | CREATE UNIQUE INDEX form_submissions_pkey ON public.form_submissions USING btree (id) |  |
| form_submissions | idx_form_submissions_form | false | false | btree | CREATE INDEX idx_form_submissions_form ON public.form_submissions USING btree (form_id, created_at DESC) |  |
| form_submissions | idx_form_submissions_lead | false | false | btree | CREATE INDEX idx_form_submissions_lead ON public.form_submissions USING btree (lead_id) WHERE (lead_id IS NOT NULL) | (lead_id IS NOT NULL) |
| form_submissions | idx_form_submissions_tenant | false | false | btree | CREATE INDEX idx_form_submissions_tenant ON public.form_submissions USING btree (tenant_id) |  |
| forms | forms_pkey | true | true | btree | CREATE UNIQUE INDEX forms_pkey ON public.forms USING btree (id) |  |
| forms | idx_forms_tenant_status | false | false | btree | CREATE INDEX idx_forms_tenant_status ON public.forms USING btree (tenant_id, status) WHERE (deleted_at IS NULL) | (deleted_at IS NULL) |
| integrations | idx_integrations_tenant | false | false | btree | CREATE INDEX idx_integrations_tenant ON public.integrations USING btree (tenant_id) |  |
| integrations | integrations_pkey | true | true | btree | CREATE UNIQUE INDEX integrations_pkey ON public.integrations USING btree (id) |  |
| integrations | integrations_tenant_id_provider_key | true | false | btree | CREATE UNIQUE INDEX integrations_tenant_id_provider_key ON public.integrations USING btree (tenant_id, provider) |  |
| inventory_items | idx_inventory_items_tenant | false | false | btree | CREATE INDEX idx_inventory_items_tenant ON public.inventory_items USING btree (tenant_id) |  |
| inventory_items | idx_inventory_items_tenant_cat | false | false | btree | CREATE INDEX idx_inventory_items_tenant_cat ON public.inventory_items USING btree (tenant_id, categoria) |  |
| inventory_items | idx_inventory_items_tenant_deleted | false | false | btree | CREATE INDEX idx_inventory_items_tenant_deleted ON public.inventory_items USING btree (tenant_id, deleted_at) |  |
| inventory_items | idx_inventory_items_tenant_status | false | false | btree | CREATE INDEX idx_inventory_items_tenant_status ON public.inventory_items USING btree (tenant_id, status) |  |
| inventory_items | inventory_items_pkey | true | true | btree | CREATE UNIQUE INDEX inventory_items_pkey ON public.inventory_items USING btree (id) |  |
| invoices | idx_invoices_tenant_active | false | false | btree | CREATE INDEX idx_invoices_tenant_active ON public.invoices USING btree (tenant_id, deleted_at, created_at DESC) WHERE (deleted_at IS NULL) | (deleted_at IS NULL) |
| invoices | idx_invoices_tenant_id | false | false | btree | CREATE INDEX idx_invoices_tenant_id ON public.invoices USING btree (tenant_id) |  |
| invoices | idx_invoices_tenant_status | false | false | btree | CREATE INDEX idx_invoices_tenant_status ON public.invoices USING btree (tenant_id, status) |  |
| invoices | invoices_pkey | true | true | btree | CREATE UNIQUE INDEX invoices_pkey ON public.invoices USING btree (id) |  |
| invoices | uq_invoices_stripe_invoice | true | false | btree | CREATE UNIQUE INDEX uq_invoices_stripe_invoice ON public.invoices USING btree (stripe_invoice_id) WHERE (stripe_invoice_id IS NOT NULL) | (stripe_invoice_id IS NOT NULL) |
| job_functions | idx_job_functions_tenant_id | false | false | btree | CREATE INDEX idx_job_functions_tenant_id ON public.job_functions USING btree (tenant_id) |  |
| job_functions | job_functions_pkey | true | true | btree | CREATE UNIQUE INDEX job_functions_pkey ON public.job_functions USING btree (id) |  |
| job_functions | uq_job_functions_tenant_slug | true | false | btree | CREATE UNIQUE INDEX uq_job_functions_tenant_slug ON public.job_functions USING btree (tenant_id, slug) WHERE (deleted_at IS NULL) | (deleted_at IS NULL) |
| lead_interactions | idx_lead_interactions_lead | false | false | btree | CREATE INDEX idx_lead_interactions_lead ON public.lead_interactions USING btree (lead_id) |  |
| lead_interactions | idx_lead_interactions_tenant | false | false | btree | CREATE INDEX idx_lead_interactions_tenant ON public.lead_interactions USING btree (tenant_id) |  |
| lead_interactions | lead_interactions_pkey | true | true | btree | CREATE UNIQUE INDEX lead_interactions_pkey ON public.lead_interactions USING btree (id) |  |
| lead_uploads | idx_lead_uploads_lead | false | false | btree | CREATE INDEX idx_lead_uploads_lead ON public.lead_uploads USING btree (tenant_id, lead_id, created_at DESC) |  |
| lead_uploads | lead_uploads_pkey | true | true | btree | CREATE UNIQUE INDEX lead_uploads_pkey ON public.lead_uploads USING btree (id) |  |
| leads | idx_leads_cidade | false | false | btree | CREATE INDEX idx_leads_cidade ON public.leads USING btree (tenant_id, cidade) |  |
| leads | idx_leads_cliente_id | false | false | btree | CREATE INDEX idx_leads_cliente_id ON public.leads USING btree (cliente_id) |  |
| leads | idx_leads_estado | false | false | btree | CREATE INDEX idx_leads_estado ON public.leads USING btree (tenant_id, estado) |  |
| leads | idx_leads_origemlead | false | false | btree | CREATE INDEX idx_leads_origemlead ON public.leads USING btree (tenant_id, origem_lead) |  |
| leads | idx_leads_payload_servico | false | false | gin | CREATE INDEX idx_leads_payload_servico ON public.leads USING gin (payload_servico) |  |
| leads | idx_leads_responsavel | false | false | btree | CREATE INDEX idx_leads_responsavel ON public.leads USING btree (tenant_id, responsavel) |  |
| leads | idx_leads_status | false | false | btree | CREATE INDEX idx_leads_status ON public.leads USING btree (tenant_id, status) WHERE (deleted_at IS NULL) | (deleted_at IS NULL) |
| leads | idx_leads_tags | false | false | gin | CREATE INDEX idx_leads_tags ON public.leads USING gin (tags) |  |
| leads | idx_leads_tenant_active | false | false | btree | CREATE INDEX idx_leads_tenant_active ON public.leads USING btree (tenant_id, deleted_at, created_at DESC) WHERE (deleted_at IS NULL) | (deleted_at IS NULL) |
| leads | idx_leads_tenant_id | false | false | btree | CREATE INDEX idx_leads_tenant_id ON public.leads USING btree (tenant_id) |  |
| leads | idx_leads_tenant_status | false | false | btree | CREATE INDEX idx_leads_tenant_status ON public.leads USING btree (tenant_id, status) |  |
| leads | idx_leads_tiposervico | false | false | btree | CREATE INDEX idx_leads_tiposervico ON public.leads USING btree (tenant_id, tipo_servico) |  |
| leads | leads_pkey | true | true | btree | CREATE UNIQUE INDEX leads_pkey ON public.leads USING btree (id) |  |
| leads | ux_leads_id_tenant | true | false | btree | CREATE UNIQUE INDEX ux_leads_id_tenant ON public.leads USING btree (id, tenant_id) |  |
| leave_requests | idx_leave_employee_id | false | false | btree | CREATE INDEX idx_leave_employee_id ON public.leave_requests USING btree (employee_id) |  |
| leave_requests | idx_leave_tenant_id | false | false | btree | CREATE INDEX idx_leave_tenant_id ON public.leave_requests USING btree (tenant_id) |  |
| leave_requests | leave_requests_pkey | true | true | btree | CREATE UNIQUE INDEX leave_requests_pkey ON public.leave_requests USING btree (id) |  |
| licenses | idx_licenses_tenant | false | false | btree | CREATE INDEX idx_licenses_tenant ON public.licenses USING btree (tenant_id) |  |
| licenses | idx_licenses_tenant_deleted | false | false | btree | CREATE INDEX idx_licenses_tenant_deleted ON public.licenses USING btree (tenant_id, deleted_at) |  |
| licenses | idx_licenses_tenant_obra | false | false | btree | CREATE INDEX idx_licenses_tenant_obra ON public.licenses USING btree (tenant_id, obra_id) |  |
| licenses | idx_licenses_tenant_status | false | false | btree | CREATE INDEX idx_licenses_tenant_status ON public.licenses USING btree (tenant_id, status) |  |
| licenses | licenses_pkey | true | true | btree | CREATE UNIQUE INDEX licenses_pkey ON public.licenses USING btree (id) |  |
| marketing_asset_approvals | idx_marketing_asset_approvals_asset | false | false | btree | CREATE INDEX idx_marketing_asset_approvals_asset ON public.marketing_asset_approvals USING btree (tenant_id, asset_id, requested_at DESC) |  |
| marketing_asset_approvals | idx_marketing_asset_approvals_status | false | false | btree | CREATE INDEX idx_marketing_asset_approvals_status ON public.marketing_asset_approvals USING btree (tenant_id, status) |  |
| marketing_asset_approvals | idx_marketing_asset_approvals_version | false | false | btree | CREATE INDEX idx_marketing_asset_approvals_version ON public.marketing_asset_approvals USING btree (tenant_id, version_id) |  |
| marketing_asset_approvals | marketing_asset_approvals_pkey | true | true | btree | CREATE UNIQUE INDEX marketing_asset_approvals_pkey ON public.marketing_asset_approvals USING btree (id) |  |
| marketing_asset_versions | idx_marketing_asset_versions_status | false | false | btree | CREATE INDEX idx_marketing_asset_versions_status ON public.marketing_asset_versions USING btree (tenant_id, status) |  |
| marketing_asset_versions | marketing_asset_versions_pkey | true | true | btree | CREATE UNIQUE INDEX marketing_asset_versions_pkey ON public.marketing_asset_versions USING btree (id) |  |
| marketing_asset_versions | uq_marketing_asset_versions_asset_version | true | false | btree | CREATE UNIQUE INDEX uq_marketing_asset_versions_asset_version ON public.marketing_asset_versions USING btree (tenant_id, asset_id, version) |  |
| marketing_assets | idx_marketing_assets_artist | false | false | btree | CREATE INDEX idx_marketing_assets_artist ON public.marketing_assets USING btree (tenant_id, artist_id) |  |
| marketing_assets | idx_marketing_assets_company | false | false | btree | CREATE INDEX idx_marketing_assets_company ON public.marketing_assets USING btree (tenant_id, company_id) |  |
| marketing_assets | idx_marketing_assets_deleted | false | false | btree | CREATE INDEX idx_marketing_assets_deleted ON public.marketing_assets USING btree (tenant_id, deleted_at) |  |
| marketing_assets | idx_marketing_assets_project | false | false | btree | CREATE INDEX idx_marketing_assets_project ON public.marketing_assets USING btree (tenant_id, marketing_project_id) |  |
| marketing_assets | idx_marketing_assets_status | false | false | btree | CREATE INDEX idx_marketing_assets_status ON public.marketing_assets USING btree (tenant_id, status) |  |
| marketing_assets | idx_marketing_assets_tenant | false | false | btree | CREATE INDEX idx_marketing_assets_tenant ON public.marketing_assets USING btree (tenant_id) |  |
| marketing_assets | idx_marketing_assets_type | false | false | btree | CREATE INDEX idx_marketing_assets_type ON public.marketing_assets USING btree (tenant_id, asset_type) |  |
| marketing_assets | marketing_assets_pkey | true | true | btree | CREATE UNIQUE INDEX marketing_assets_pkey ON public.marketing_assets USING btree (id) |  |
| marketing_content_posts | idx_marketing_content_posts_tenant_campaign | false | false | btree | CREATE INDEX idx_marketing_content_posts_tenant_campaign ON public.marketing_content_posts USING btree (tenant_id, campaign_id) WHERE (deleted_at IS NULL) | (deleted_at IS NULL) |
| marketing_content_posts | idx_marketing_content_posts_tenant_project | false | false | btree | CREATE INDEX idx_marketing_content_posts_tenant_project ON public.marketing_content_posts USING btree (tenant_id, project_id) WHERE (deleted_at IS NULL) | (deleted_at IS NULL) |
| marketing_content_posts | idx_marketing_content_posts_tenant_publication | false | false | btree | CREATE INDEX idx_marketing_content_posts_tenant_publication ON public.marketing_content_posts USING btree (tenant_id, publication_status) WHERE (deleted_at IS NULL) | (deleted_at IS NULL) |
| marketing_content_posts | idx_marketing_content_posts_tenant_scheduled | false | false | btree | CREATE INDEX idx_marketing_content_posts_tenant_scheduled ON public.marketing_content_posts USING btree (tenant_id, scheduled_for) WHERE (deleted_at IS NULL) | (deleted_at IS NULL) |
| marketing_content_posts | idx_marketing_content_posts_tenant_status | false | false | btree | CREATE INDEX idx_marketing_content_posts_tenant_status ON public.marketing_content_posts USING btree (tenant_id, status) WHERE (deleted_at IS NULL) | (deleted_at IS NULL) |
| marketing_content_posts | marketing_content_posts_pkey | true | true | btree | CREATE UNIQUE INDEX marketing_content_posts_pkey ON public.marketing_content_posts USING btree (id) |  |
| marketing_projects | idx_marketing_projects_artist | false | false | btree | CREATE INDEX idx_marketing_projects_artist ON public.marketing_projects USING btree (tenant_id, artist_id) |  |
| marketing_projects | idx_marketing_projects_campaign | false | false | btree | CREATE INDEX idx_marketing_projects_campaign ON public.marketing_projects USING btree (tenant_id, campaign_id) |  |
| marketing_projects | idx_marketing_projects_deleted | false | false | btree | CREATE INDEX idx_marketing_projects_deleted ON public.marketing_projects USING btree (tenant_id, deleted_at) |  |
| marketing_projects | idx_marketing_projects_financial_project | false | false | btree | CREATE INDEX idx_marketing_projects_financial_project ON public.marketing_projects USING btree (tenant_id, financial_project_id) |  |
| marketing_projects | idx_marketing_projects_tenant | false | false | btree | CREATE INDEX idx_marketing_projects_tenant ON public.marketing_projects USING btree (tenant_id) |  |
| marketing_projects | idx_marketing_projects_tenant_status | false | false | btree | CREATE INDEX idx_marketing_projects_tenant_status ON public.marketing_projects USING btree (tenant_id, status) |  |
| marketing_projects | idx_marketing_projects_tenant_type | false | false | btree | CREATE INDEX idx_marketing_projects_tenant_type ON public.marketing_projects USING btree (tenant_id, type) |  |
| marketing_projects | marketing_projects_pkey | true | true | btree | CREATE UNIQUE INDEX marketing_projects_pkey ON public.marketing_projects USING btree (id) |  |
| marketing_projects | uq_marketing_projects_source_project | true | false | btree | CREATE UNIQUE INDEX uq_marketing_projects_source_project ON public.marketing_projects USING btree (tenant_id, source_project_id) WHERE ((source_project_id IS NOT NULL) AND (deleted_at IS NULL)) | ((source_project_id IS NOT NULL) AND (deleted_at IS NULL)) |
| marketing_strategies | idx_mkt_strategies_project | false | false | btree | CREATE INDEX idx_mkt_strategies_project ON public.marketing_strategies USING btree (tenant_id, marketing_project_id) |  |
| marketing_strategies | idx_mkt_strategies_status | false | false | btree | CREATE INDEX idx_mkt_strategies_status ON public.marketing_strategies USING btree (tenant_id, status) |  |
| marketing_strategies | marketing_strategies_pkey | true | true | btree | CREATE UNIQUE INDEX marketing_strategies_pkey ON public.marketing_strategies USING btree (id) |  |
| marketing_strategy_actions | idx_mkt_actions_initiative | false | false | btree | CREATE INDEX idx_mkt_actions_initiative ON public.marketing_strategy_actions USING btree (tenant_id, initiative_id) |  |
| marketing_strategy_actions | idx_mkt_actions_project | false | false | btree | CREATE INDEX idx_mkt_actions_project ON public.marketing_strategy_actions USING btree (tenant_id, marketing_project_id) |  |
| marketing_strategy_actions | idx_mkt_actions_status | false | false | btree | CREATE INDEX idx_mkt_actions_status ON public.marketing_strategy_actions USING btree (tenant_id, status) |  |
| marketing_strategy_actions | marketing_strategy_actions_pkey | true | true | btree | CREATE UNIQUE INDEX marketing_strategy_actions_pkey ON public.marketing_strategy_actions USING btree (id) |  |
| marketing_strategy_initiatives | idx_mkt_initiatives_objective | false | false | btree | CREATE INDEX idx_mkt_initiatives_objective ON public.marketing_strategy_initiatives USING btree (tenant_id, objective_id) |  |
| marketing_strategy_initiatives | idx_mkt_initiatives_project | false | false | btree | CREATE INDEX idx_mkt_initiatives_project ON public.marketing_strategy_initiatives USING btree (tenant_id, marketing_project_id) |  |
| marketing_strategy_initiatives | marketing_strategy_initiatives_pkey | true | true | btree | CREATE UNIQUE INDEX marketing_strategy_initiatives_pkey ON public.marketing_strategy_initiatives USING btree (id) |  |
| marketing_strategy_objectives | idx_mkt_objectives_project | false | false | btree | CREATE INDEX idx_mkt_objectives_project ON public.marketing_strategy_objectives USING btree (tenant_id, marketing_project_id) |  |
| marketing_strategy_objectives | idx_mkt_objectives_strategy | false | false | btree | CREATE INDEX idx_mkt_objectives_strategy ON public.marketing_strategy_objectives USING btree (tenant_id, strategy_id) |  |
| marketing_strategy_objectives | marketing_strategy_objectives_pkey | true | true | btree | CREATE UNIQUE INDEX marketing_strategy_objectives_pkey ON public.marketing_strategy_objectives USING btree (id) |  |
| marketing_tasks | idx_marketing_tasks_due | false | false | btree | CREATE INDEX idx_marketing_tasks_due ON public.marketing_tasks USING btree (tenant_id, due_date) |  |
| marketing_tasks | idx_marketing_tasks_project | false | false | btree | CREATE INDEX idx_marketing_tasks_project ON public.marketing_tasks USING btree (tenant_id, marketing_project_id) |  |
| marketing_tasks | idx_marketing_tasks_status | false | false | btree | CREATE INDEX idx_marketing_tasks_status ON public.marketing_tasks USING btree (tenant_id, status) |  |
| marketing_tasks | idx_marketing_tasks_tenant | false | false | btree | CREATE INDEX idx_marketing_tasks_tenant ON public.marketing_tasks USING btree (tenant_id) |  |
| marketing_tasks | marketing_tasks_pkey | true | true | btree | CREATE UNIQUE INDEX marketing_tasks_pkey ON public.marketing_tasks USING btree (id) |  |
| marketing_tasks | uq_marketing_tasks_project_key | true | false | btree | CREATE UNIQUE INDEX uq_marketing_tasks_project_key ON public.marketing_tasks USING btree (tenant_id, marketing_project_id, task_key) |  |
| membership_job_functions | idx_mjf_jobfn | false | false | btree | CREATE INDEX idx_mjf_jobfn ON public.membership_job_functions USING btree (job_function_id) |  |
| membership_job_functions | idx_mjf_member | false | false | btree | CREATE INDEX idx_mjf_member ON public.membership_job_functions USING btree (membership_id) |  |
| membership_job_functions | idx_mjf_tenant | false | false | btree | CREATE INDEX idx_mjf_tenant ON public.membership_job_functions USING btree (tenant_id) |  |
| membership_job_functions | membership_job_functions_pkey | true | true | btree | CREATE UNIQUE INDEX membership_job_functions_pkey ON public.membership_job_functions USING btree (id) |  |
| membership_job_functions | uq_mjf_membership_jobfn | true | false | btree | CREATE UNIQUE INDEX uq_mjf_membership_jobfn ON public.membership_job_functions USING btree (membership_id, job_function_id) |  |
| musicchat_automation_events | idx_musicchat_automation_events_conv | false | false | btree | CREATE INDEX idx_musicchat_automation_events_conv ON public.musicchat_automation_events USING btree (tenant_id, conversation_id, created_at DESC) |  |
| musicchat_automation_events | idx_musicchat_automation_events_type | false | false | btree | CREATE INDEX idx_musicchat_automation_events_type ON public.musicchat_automation_events USING btree (tenant_id, event_type) |  |
| musicchat_automation_events | musicchat_automation_events_pkey | true | true | btree | CREATE UNIQUE INDEX musicchat_automation_events_pkey ON public.musicchat_automation_events USING btree (id) |  |
| musicchat_automation_notifications | idx_musicchat_automation_notifications_status | false | false | btree | CREATE INDEX idx_musicchat_automation_notifications_status ON public.musicchat_automation_notifications USING btree (tenant_id, status) |  |
| musicchat_automation_notifications | musicchat_automation_notifications_pkey | true | true | btree | CREATE UNIQUE INDEX musicchat_automation_notifications_pkey ON public.musicchat_automation_notifications USING btree (id) |  |
| musicchat_automation_notifications | uq_musicchat_escalation_notification | true | false | btree | CREATE UNIQUE INDEX uq_musicchat_escalation_notification ON public.musicchat_automation_notifications USING btree (tenant_id, conversation_id, level) |  |
| musicchat_automation_settings | musicchat_automation_settings_pkey | true | true | btree | CREATE UNIQUE INDEX musicchat_automation_settings_pkey ON public.musicchat_automation_settings USING btree (id) |  |
| musicchat_automation_settings | musicchat_automation_settings_tenant_id_key | true | false | btree | CREATE UNIQUE INDEX musicchat_automation_settings_tenant_id_key ON public.musicchat_automation_settings USING btree (tenant_id) |  |
| musicos360_migrations | PK_5698469732c41de5057512bf3c6 | true | true | btree | CREATE UNIQUE INDEX "PK_5698469732c41de5057512bf3c6" ON public.musicos360_migrations USING btree (id) |  |
| notification_settings | idx_notification_settings_tenant_id | false | false | btree | CREATE INDEX idx_notification_settings_tenant_id ON public.notification_settings USING btree (tenant_id) |  |
| notification_settings | notification_settings_pkey | true | true | btree | CREATE UNIQUE INDEX notification_settings_pkey ON public.notification_settings USING btree (id) |  |
| notification_settings | uq_notification_settings_tenant_key | true | false | btree | CREATE UNIQUE INDEX uq_notification_settings_tenant_key ON public.notification_settings USING btree (tenant_id, notification_key) |  |
| notifications | idx_notifications_tenant_user | false | false | btree | CREATE INDEX idx_notifications_tenant_user ON public.notifications USING btree (tenant_id, user_id) |  |
| notifications | idx_notifications_tenant_user_readat | false | false | btree | CREATE INDEX idx_notifications_tenant_user_readat ON public.notifications USING btree (tenant_id, user_id, read_at) |  |
| notifications | notifications_pkey | true | true | btree | CREATE UNIQUE INDEX notifications_pkey ON public.notifications USING btree (id) |  |
| oauth_connections | idx_oauth_tenant_id | false | false | btree | CREATE INDEX idx_oauth_tenant_id ON public.oauth_connections USING btree (tenant_id) |  |
| oauth_connections | idx_oauth_tenant_user_provider | false | false | btree | CREATE INDEX idx_oauth_tenant_user_provider ON public.oauth_connections USING btree (tenant_id, user_id, provider) |  |
| oauth_connections | oauth_connections_pkey | true | true | btree | CREATE UNIQUE INDEX oauth_connections_pkey ON public.oauth_connections USING btree (id) |  |
| oauth_connections | oauth_connections_tenant_id_user_id_provider_key | true | false | btree | CREATE UNIQUE INDEX oauth_connections_tenant_id_user_id_provider_key ON public.oauth_connections USING btree (tenant_id, user_id, provider) |  |
| operational_list_items | idx_operational_list_items_tenant_kind | false | false | btree | CREATE INDEX idx_operational_list_items_tenant_kind ON public.operational_list_items USING btree (tenant_id, kind, "order") |  |
| operational_list_items | operational_list_items_pkey | true | true | btree | CREATE UNIQUE INDEX operational_list_items_pkey ON public.operational_list_items USING btree (id) |  |
| operational_list_items | uq_operational_list_items_tenant_kind_slug | true | false | btree | CREATE UNIQUE INDEX uq_operational_list_items_tenant_kind_slug ON public.operational_list_items USING btree (tenant_id, kind, slug) WHERE (deleted_at IS NULL) | (deleted_at IS NULL) |
| operational_tasks | idx_operational_tasks_assignee | false | false | btree | CREATE INDEX idx_operational_tasks_assignee ON public.operational_tasks USING btree (tenant_id, assigned_to) |  |
| operational_tasks | idx_operational_tasks_tenant_status | false | false | btree | CREATE INDEX idx_operational_tasks_tenant_status ON public.operational_tasks USING btree (tenant_id, status, due_date) |  |
| operational_tasks | idx_operational_tasks_tenant_type | false | false | btree | CREATE INDEX idx_operational_tasks_tenant_type ON public.operational_tasks USING btree (tenant_id, type) |  |
| operational_tasks | operational_tasks_pkey | true | true | btree | CREATE UNIQUE INDEX operational_tasks_pkey ON public.operational_tasks USING btree (id) |  |
| org_members | idx_org_members_department_id | false | false | btree | CREATE INDEX idx_org_members_department_id ON public.org_members USING btree (department_id) |  |
| org_members | idx_org_members_position_id | false | false | btree | CREATE INDEX idx_org_members_position_id ON public.org_members USING btree (position_id) |  |
| org_members | idx_org_members_role_id | false | false | btree | CREATE INDEX idx_org_members_role_id ON public.org_members USING btree (role_id) |  |
| org_members | idx_org_members_tenant_id | false | false | btree | CREATE INDEX idx_org_members_tenant_id ON public.org_members USING btree (tenant_id) |  |
| org_members | member_auth_user_idx | false | false | btree | CREATE INDEX member_auth_user_idx ON public.org_members USING btree (auth_user_id) |  |
| org_members | member_tenant_user_idx | true | false | btree | CREATE UNIQUE INDEX member_tenant_user_idx ON public.org_members USING btree (tenant_id, auth_user_id) |  |
| org_members | org_members_pkey | true | true | btree | CREATE UNIQUE INDEX org_members_pkey ON public.org_members USING btree (id) |  |
| org_members | org_members_tenant_id_auth_user_id_key | true | false | btree | CREATE UNIQUE INDEX org_members_tenant_id_auth_user_id_key ON public.org_members USING btree (tenant_id, auth_user_id) |  |
| organizations | idx_organizations_slug | false | false | btree | CREATE INDEX idx_organizations_slug ON public.organizations USING btree (slug) |  |
| organizations | org_external_auth_idx | false | false | btree | CREATE INDEX org_external_auth_idx ON public.organizations USING btree (external_auth_org_id) |  |
| organizations | organizations_external_auth_org_id_key | true | false | btree | CREATE UNIQUE INDEX organizations_external_auth_org_id_key ON public.organizations USING btree (external_auth_org_id) |  |
| organizations | organizations_pkey | true | true | btree | CREATE UNIQUE INDEX organizations_pkey ON public.organizations USING btree (id) |  |
| organizations | organizations_single_system_tenant | true | false | btree | CREATE UNIQUE INDEX organizations_single_system_tenant ON public.organizations USING btree (is_system_tenant) WHERE (is_system_tenant = true) | (is_system_tenant = true) |
| organizations | organizations_slug_key | true | false | btree | CREATE UNIQUE INDEX organizations_slug_key ON public.organizations USING btree (slug) |  |
| payment_events | idx_payment_events_tenant | false | false | btree | CREATE INDEX idx_payment_events_tenant ON public.payment_events USING btree (tenant_id) |  |
| payment_events | idx_payment_events_type | false | false | btree | CREATE INDEX idx_payment_events_type ON public.payment_events USING btree (event_type) |  |
| payment_events | payment_events_pkey | true | true | btree | CREATE UNIQUE INDEX payment_events_pkey ON public.payment_events USING btree (id) |  |
| payment_events | uq_payment_events_stripe_event_id | true | false | btree | CREATE UNIQUE INDEX uq_payment_events_stripe_event_id ON public.payment_events USING btree (stripe_event_id) |  |
| payroll_entries | idx_payroll_employee_id | false | false | btree | CREATE INDEX idx_payroll_employee_id ON public.payroll_entries USING btree (employee_id) |  |
| payroll_entries | idx_payroll_tenant_id | false | false | btree | CREATE INDEX idx_payroll_tenant_id ON public.payroll_entries USING btree (tenant_id) |  |
| payroll_entries | payroll_entries_employee_id_competencia_key | true | false | btree | CREATE UNIQUE INDEX payroll_entries_employee_id_competencia_key ON public.payroll_entries USING btree (employee_id, competencia) |  |
| payroll_entries | payroll_entries_pkey | true | true | btree | CREATE UNIQUE INDEX payroll_entries_pkey ON public.payroll_entries USING btree (id) |  |
| performance_metric_entries | idx_metric_tenant_artist_period | false | false | btree | CREATE INDEX idx_metric_tenant_artist_period ON public.performance_metric_entries USING btree (tenant_id, artist_id, period_start) |  |
| performance_metric_entries | idx_metric_tenant_phonogram_period | false | false | btree | CREATE INDEX idx_metric_tenant_phonogram_period ON public.performance_metric_entries USING btree (tenant_id, phonogram_id, period_start) |  |
| performance_metric_entries | idx_metric_tenant_platform_type | false | false | btree | CREATE INDEX idx_metric_tenant_platform_type ON public.performance_metric_entries USING btree (tenant_id, platform, metric_type) |  |
| performance_metric_entries | performance_metric_entries_pkey | true | true | btree | CREATE UNIQUE INDEX performance_metric_entries_pkey ON public.performance_metric_entries USING btree (id) |  |
| performance_metric_entries | uq_metric_active_dedupe | true | false | btree | CREATE UNIQUE INDEX uq_metric_active_dedupe ON public.performance_metric_entries USING btree (tenant_id, metric_type, platform, phonogram_id, release_id, artist_id, period_start, period_end, source) NULLS NOT DISTINCT WHERE (superseded_by_id IS NULL) | (superseded_by_id IS NULL) |
| performance_metric_entries | uq_perf_metric_entries_tenant_id_id | true | false | btree | CREATE UNIQUE INDEX uq_perf_metric_entries_tenant_id_id ON public.performance_metric_entries USING btree (tenant_id, id) |  |
| permission_aliases | permission_aliases_pkey | true | true | btree | CREATE UNIQUE INDEX permission_aliases_pkey ON public.permission_aliases USING btree (id) |  |
| permission_aliases | uq_permission_aliases_legacy_key | true | false | btree | CREATE UNIQUE INDEX uq_permission_aliases_legacy_key ON public.permission_aliases USING btree (legacy_key) |  |
| permission_conflicts | idx_permission_conflicts_conflicts_with_permission_id | false | false | btree | CREATE INDEX idx_permission_conflicts_conflicts_with_permission_id ON public.permission_conflicts USING btree (conflicts_with_permission_id) |  |
| permission_conflicts | idx_permission_conflicts_permission_id | false | false | btree | CREATE INDEX idx_permission_conflicts_permission_id ON public.permission_conflicts USING btree (permission_id) |  |
| permission_conflicts | permission_conflicts_pkey | true | true | btree | CREATE UNIQUE INDEX permission_conflicts_pkey ON public.permission_conflicts USING btree (id) |  |
| permission_conflicts | uq_permission_conflicts_normalized_pair | true | false | btree | CREATE UNIQUE INDEX uq_permission_conflicts_normalized_pair ON public.permission_conflicts USING btree (permission_id, conflicts_with_permission_id) |  |
| permission_dependencies | idx_permission_dependencies_depends_on_permission_id | false | false | btree | CREATE INDEX idx_permission_dependencies_depends_on_permission_id ON public.permission_dependencies USING btree (depends_on_permission_id) |  |
| permission_dependencies | idx_permission_dependencies_permission_id | false | false | btree | CREATE INDEX idx_permission_dependencies_permission_id ON public.permission_dependencies USING btree (permission_id) |  |
| permission_dependencies | permission_dependencies_pkey | true | true | btree | CREATE UNIQUE INDEX permission_dependencies_pkey ON public.permission_dependencies USING btree (id) |  |
| permission_dependencies | uq_permission_dependencies_pair | true | false | btree | CREATE UNIQUE INDEX uq_permission_dependencies_pair ON public.permission_dependencies USING btree (permission_id, depends_on_permission_id) |  |
| permission_groups | idx_permission_groups_domain | false | false | btree | CREATE INDEX idx_permission_groups_domain ON public.permission_groups USING btree (domain) |  |
| permission_groups | permission_groups_pkey | true | true | btree | CREATE UNIQUE INDEX permission_groups_pkey ON public.permission_groups USING btree (id) |  |
| permission_groups | uq_permission_groups_key | true | false | btree | CREATE UNIQUE INDEX uq_permission_groups_key ON public.permission_groups USING btree (key) |  |
| permissions | idx_permissions_group_id | false | false | btree | CREATE INDEX idx_permissions_group_id ON public.permissions USING btree (group_id) |  |
| permissions | idx_permissions_resource | false | false | btree | CREATE INDEX idx_permissions_resource ON public.permissions USING btree (resource) |  |
| permissions | permissions_pkey | true | true | btree | CREATE UNIQUE INDEX permissions_pkey ON public.permissions USING btree (id) |  |
| permissions | uq_permissions_key | true | false | btree | CREATE UNIQUE INDEX uq_permissions_key ON public.permissions USING btree (key) |  |
| permissions | uq_permissions_resource_action | true | false | btree | CREATE UNIQUE INDEX uq_permissions_resource_action ON public.permissions USING btree (resource, action) |  |
| phonograms | idx_phonograms_artista_id | false | false | btree | CREATE INDEX idx_phonograms_artista_id ON public.phonograms USING btree (artista_id) |  |
| phonograms | idx_phonograms_audio_file | false | false | btree | CREATE INDEX idx_phonograms_audio_file ON public.phonograms USING btree (audio_file_id) |  |
| phonograms | idx_phonograms_isrc | false | false | btree | CREATE INDEX idx_phonograms_isrc ON public.phonograms USING btree (isrc) |  |
| phonograms | idx_phonograms_obra_id | false | false | btree | CREATE INDEX idx_phonograms_obra_id ON public.phonograms USING btree (obra_id) |  |
| phonograms | idx_phonograms_producer | false | false | btree | CREATE INDEX idx_phonograms_producer ON public.phonograms USING btree (phonographic_producer_id) |  |
| phonograms | idx_phonograms_registry_status | false | false | btree | CREATE INDEX idx_phonograms_registry_status ON public.phonograms USING btree (tenant_id, registry_status) |  |
| phonograms | idx_phonograms_tenant_active | false | false | btree | CREATE INDEX idx_phonograms_tenant_active ON public.phonograms USING btree (tenant_id, deleted_at, created_at DESC) WHERE (deleted_at IS NULL) | (deleted_at IS NULL) |
| phonograms | idx_phonograms_tenant_id | false | false | btree | CREATE INDEX idx_phonograms_tenant_id ON public.phonograms USING btree (tenant_id) |  |
| phonograms | phonograms_pkey | true | true | btree | CREATE UNIQUE INDEX phonograms_pkey ON public.phonograms USING btree (id) |  |
| phonograms | uq_phonograms_tenant_id_id | true | false | btree | CREATE UNIQUE INDEX uq_phonograms_tenant_id_id ON public.phonograms USING btree (tenant_id, id) |  |
| pipeline_opportunities | idx_opp_contact | false | false | btree | CREATE INDEX idx_opp_contact ON public.pipeline_opportunities USING btree (tenant_id, contact_id) |  |
| pipeline_opportunities | idx_opp_deleted | false | false | btree | CREATE INDEX idx_opp_deleted ON public.pipeline_opportunities USING btree (tenant_id, deleted_at) |  |
| pipeline_opportunities | idx_opp_pipeline | false | false | btree | CREATE INDEX idx_opp_pipeline ON public.pipeline_opportunities USING btree (tenant_id, pipeline_id) |  |
| pipeline_opportunities | idx_opp_stage | false | false | btree | CREATE INDEX idx_opp_stage ON public.pipeline_opportunities USING btree (tenant_id, stage_id) |  |
| pipeline_opportunities | pipeline_opportunities_pkey | true | true | btree | CREATE UNIQUE INDEX pipeline_opportunities_pkey ON public.pipeline_opportunities USING btree (id) |  |
| pipeline_stages | idx_pipeline_stages_pipeline | false | false | btree | CREATE INDEX idx_pipeline_stages_pipeline ON public.pipeline_stages USING btree (pipeline_id, "position") |  |
| pipeline_stages | idx_pipeline_stages_tenant | false | false | btree | CREATE INDEX idx_pipeline_stages_tenant ON public.pipeline_stages USING btree (tenant_id) |  |
| pipeline_stages | pipeline_stages_pkey | true | true | btree | CREATE UNIQUE INDEX pipeline_stages_pkey ON public.pipeline_stages USING btree (id) |  |
| pipelines | idx_pipelines_tenant | false | false | btree | CREATE INDEX idx_pipelines_tenant ON public.pipelines USING btree (tenant_id) |  |
| pipelines | pipelines_pkey | true | true | btree | CREATE UNIQUE INDEX pipelines_pkey ON public.pipelines USING btree (id) |  |
| positions | idx_positions_department_id | false | false | btree | CREATE INDEX idx_positions_department_id ON public.positions USING btree (department_id) |  |
| positions | idx_positions_tenant_id | false | false | btree | CREATE INDEX idx_positions_tenant_id ON public.positions USING btree (tenant_id) |  |
| positions | positions_pkey | true | true | btree | CREATE UNIQUE INDEX positions_pkey ON public.positions USING btree (id) |  |
| positions | uq_positions_tenant_slug | true | false | btree | CREATE UNIQUE INDEX uq_positions_tenant_slug ON public.positions USING btree (tenant_id, slug) WHERE (deleted_at IS NULL) | (deleted_at IS NULL) |
| project_assets | idx_project_assets_project | false | false | btree | CREATE INDEX idx_project_assets_project ON public.project_assets USING btree (tenant_id, project_id) |  |
| project_assets | idx_project_assets_tenant | false | false | btree | CREATE INDEX idx_project_assets_tenant ON public.project_assets USING btree (tenant_id) |  |
| project_assets | project_assets_pkey | true | true | btree | CREATE UNIQUE INDEX project_assets_pkey ON public.project_assets USING btree (id) |  |
| project_assets | uq_project_assets_project_asset | true | false | btree | CREATE UNIQUE INDEX uq_project_assets_project_asset ON public.project_assets USING btree (tenant_id, project_id, asset_id) |  |
| project_track_participants | idx_project_track_participants_tenant_track | false | false | btree | CREATE INDEX idx_project_track_participants_tenant_track ON public.project_track_participants USING btree (tenant_id, project_track_id) |  |
| project_track_participants | project_track_participants_pkey | true | true | btree | CREATE UNIQUE INDEX project_track_participants_pkey ON public.project_track_participants USING btree (id) |  |
| project_tracks | idx_project_tracks_tenant_project | false | false | btree | CREATE INDEX idx_project_tracks_tenant_project ON public.project_tracks USING btree (tenant_id, project_id) |  |
| project_tracks | project_tracks_pkey | true | true | btree | CREATE UNIQUE INDEX project_tracks_pkey ON public.project_tracks USING btree (id) |  |
| projects | idx_projects_tenant_active | false | false | btree | CREATE INDEX idx_projects_tenant_active ON public.projects USING btree (tenant_id, deleted_at, created_at DESC) WHERE (deleted_at IS NULL) | (deleted_at IS NULL) |
| projects | idx_projects_tenant_id | false | false | btree | CREATE INDEX idx_projects_tenant_id ON public.projects USING btree (tenant_id) |  |
| projects | projects_pkey | true | true | btree | CREATE UNIQUE INDEX projects_pkey ON public.projects USING btree (id) |  |
| projects | uq_projects_tenant_id_id | true | false | btree | CREATE UNIQUE INDEX uq_projects_tenant_id_id ON public.projects USING btree (tenant_id, id) |  |
| rbac_decision_logs | IDX_rbac_decision_comparison | false | false | btree | CREATE INDEX "IDX_rbac_decision_comparison" ON ONLY public.rbac_decision_logs USING btree (comparison_result, created_at) |  |
| rbac_decision_logs | IDX_rbac_decision_created_at | false | false | btree | CREATE INDEX "IDX_rbac_decision_created_at" ON ONLY public.rbac_decision_logs USING btree (created_at) |  |
| rbac_decision_logs | IDX_rbac_decision_request | false | false | btree | CREATE INDEX "IDX_rbac_decision_request" ON ONLY public.rbac_decision_logs USING btree (request_id) |  |
| rbac_decision_logs | IDX_rbac_decision_resource_action | false | false | btree | CREATE INDEX "IDX_rbac_decision_resource_action" ON ONLY public.rbac_decision_logs USING btree (resource, action, created_at) |  |
| rbac_decision_logs | IDX_rbac_decision_role | false | false | btree | CREATE INDEX "IDX_rbac_decision_role" ON ONLY public.rbac_decision_logs USING btree (role_id, created_at) |  |
| rbac_decision_logs | IDX_rbac_decision_tenant | false | false | btree | CREATE INDEX "IDX_rbac_decision_tenant" ON ONLY public.rbac_decision_logs USING btree (tenant_id, created_at) |  |
| rbac_decision_logs | IDX_rbac_decision_user | false | false | btree | CREATE INDEX "IDX_rbac_decision_user" ON ONLY public.rbac_decision_logs USING btree (user_id, created_at) |  |
| rbac_decision_logs | PK_rbac_decision_logs | true | true | btree | CREATE UNIQUE INDEX "PK_rbac_decision_logs" ON ONLY public.rbac_decision_logs USING btree (id, created_at) |  |
| rbac_decision_logs_2026_06 | rbac_decision_logs_2026_06_comparison_result_created_at_idx | false | false | btree | CREATE INDEX rbac_decision_logs_2026_06_comparison_result_created_at_idx ON public.rbac_decision_logs_2026_06 USING btree (comparison_result, created_at) |  |
| rbac_decision_logs_2026_06 | rbac_decision_logs_2026_06_created_at_idx | false | false | btree | CREATE INDEX rbac_decision_logs_2026_06_created_at_idx ON public.rbac_decision_logs_2026_06 USING btree (created_at) |  |
| rbac_decision_logs_2026_06 | rbac_decision_logs_2026_06_pkey | true | true | btree | CREATE UNIQUE INDEX rbac_decision_logs_2026_06_pkey ON public.rbac_decision_logs_2026_06 USING btree (id, created_at) |  |
| rbac_decision_logs_2026_06 | rbac_decision_logs_2026_06_request_id_idx | false | false | btree | CREATE INDEX rbac_decision_logs_2026_06_request_id_idx ON public.rbac_decision_logs_2026_06 USING btree (request_id) |  |
| rbac_decision_logs_2026_06 | rbac_decision_logs_2026_06_resource_action_created_at_idx | false | false | btree | CREATE INDEX rbac_decision_logs_2026_06_resource_action_created_at_idx ON public.rbac_decision_logs_2026_06 USING btree (resource, action, created_at) |  |
| rbac_decision_logs_2026_06 | rbac_decision_logs_2026_06_role_id_created_at_idx | false | false | btree | CREATE INDEX rbac_decision_logs_2026_06_role_id_created_at_idx ON public.rbac_decision_logs_2026_06 USING btree (role_id, created_at) |  |
| rbac_decision_logs_2026_06 | rbac_decision_logs_2026_06_tenant_id_created_at_idx | false | false | btree | CREATE INDEX rbac_decision_logs_2026_06_tenant_id_created_at_idx ON public.rbac_decision_logs_2026_06 USING btree (tenant_id, created_at) |  |
| rbac_decision_logs_2026_06 | rbac_decision_logs_2026_06_user_id_created_at_idx | false | false | btree | CREATE INDEX rbac_decision_logs_2026_06_user_id_created_at_idx ON public.rbac_decision_logs_2026_06 USING btree (user_id, created_at) |  |
| rbac_decision_logs_2026_07 | rbac_decision_logs_2026_07_comparison_result_created_at_idx | false | false | btree | CREATE INDEX rbac_decision_logs_2026_07_comparison_result_created_at_idx ON public.rbac_decision_logs_2026_07 USING btree (comparison_result, created_at) |  |
| rbac_decision_logs_2026_07 | rbac_decision_logs_2026_07_created_at_idx | false | false | btree | CREATE INDEX rbac_decision_logs_2026_07_created_at_idx ON public.rbac_decision_logs_2026_07 USING btree (created_at) |  |
| rbac_decision_logs_2026_07 | rbac_decision_logs_2026_07_pkey | true | true | btree | CREATE UNIQUE INDEX rbac_decision_logs_2026_07_pkey ON public.rbac_decision_logs_2026_07 USING btree (id, created_at) |  |
| rbac_decision_logs_2026_07 | rbac_decision_logs_2026_07_request_id_idx | false | false | btree | CREATE INDEX rbac_decision_logs_2026_07_request_id_idx ON public.rbac_decision_logs_2026_07 USING btree (request_id) |  |
| rbac_decision_logs_2026_07 | rbac_decision_logs_2026_07_resource_action_created_at_idx | false | false | btree | CREATE INDEX rbac_decision_logs_2026_07_resource_action_created_at_idx ON public.rbac_decision_logs_2026_07 USING btree (resource, action, created_at) |  |
| rbac_decision_logs_2026_07 | rbac_decision_logs_2026_07_role_id_created_at_idx | false | false | btree | CREATE INDEX rbac_decision_logs_2026_07_role_id_created_at_idx ON public.rbac_decision_logs_2026_07 USING btree (role_id, created_at) |  |
| rbac_decision_logs_2026_07 | rbac_decision_logs_2026_07_tenant_id_created_at_idx | false | false | btree | CREATE INDEX rbac_decision_logs_2026_07_tenant_id_created_at_idx ON public.rbac_decision_logs_2026_07 USING btree (tenant_id, created_at) |  |
| rbac_decision_logs_2026_07 | rbac_decision_logs_2026_07_user_id_created_at_idx | false | false | btree | CREATE INDEX rbac_decision_logs_2026_07_user_id_created_at_idx ON public.rbac_decision_logs_2026_07 USING btree (user_id, created_at) |  |
| rbac_decision_logs_2026_08 | rbac_decision_logs_2026_08_comparison_result_created_at_idx | false | false | btree | CREATE INDEX rbac_decision_logs_2026_08_comparison_result_created_at_idx ON public.rbac_decision_logs_2026_08 USING btree (comparison_result, created_at) |  |
| rbac_decision_logs_2026_08 | rbac_decision_logs_2026_08_created_at_idx | false | false | btree | CREATE INDEX rbac_decision_logs_2026_08_created_at_idx ON public.rbac_decision_logs_2026_08 USING btree (created_at) |  |
| rbac_decision_logs_2026_08 | rbac_decision_logs_2026_08_pkey | true | true | btree | CREATE UNIQUE INDEX rbac_decision_logs_2026_08_pkey ON public.rbac_decision_logs_2026_08 USING btree (id, created_at) |  |
| rbac_decision_logs_2026_08 | rbac_decision_logs_2026_08_request_id_idx | false | false | btree | CREATE INDEX rbac_decision_logs_2026_08_request_id_idx ON public.rbac_decision_logs_2026_08 USING btree (request_id) |  |
| rbac_decision_logs_2026_08 | rbac_decision_logs_2026_08_resource_action_created_at_idx | false | false | btree | CREATE INDEX rbac_decision_logs_2026_08_resource_action_created_at_idx ON public.rbac_decision_logs_2026_08 USING btree (resource, action, created_at) |  |
| rbac_decision_logs_2026_08 | rbac_decision_logs_2026_08_role_id_created_at_idx | false | false | btree | CREATE INDEX rbac_decision_logs_2026_08_role_id_created_at_idx ON public.rbac_decision_logs_2026_08 USING btree (role_id, created_at) |  |
| rbac_decision_logs_2026_08 | rbac_decision_logs_2026_08_tenant_id_created_at_idx | false | false | btree | CREATE INDEX rbac_decision_logs_2026_08_tenant_id_created_at_idx ON public.rbac_decision_logs_2026_08 USING btree (tenant_id, created_at) |  |
| rbac_decision_logs_2026_08 | rbac_decision_logs_2026_08_user_id_created_at_idx | false | false | btree | CREATE INDEX rbac_decision_logs_2026_08_user_id_created_at_idx ON public.rbac_decision_logs_2026_08 USING btree (user_id, created_at) |  |
| rbac_decision_logs_2026_09 | rbac_decision_logs_2026_09_comparison_result_created_at_idx | false | false | btree | CREATE INDEX rbac_decision_logs_2026_09_comparison_result_created_at_idx ON public.rbac_decision_logs_2026_09 USING btree (comparison_result, created_at) |  |
| rbac_decision_logs_2026_09 | rbac_decision_logs_2026_09_created_at_idx | false | false | btree | CREATE INDEX rbac_decision_logs_2026_09_created_at_idx ON public.rbac_decision_logs_2026_09 USING btree (created_at) |  |
| rbac_decision_logs_2026_09 | rbac_decision_logs_2026_09_pkey | true | true | btree | CREATE UNIQUE INDEX rbac_decision_logs_2026_09_pkey ON public.rbac_decision_logs_2026_09 USING btree (id, created_at) |  |
| rbac_decision_logs_2026_09 | rbac_decision_logs_2026_09_request_id_idx | false | false | btree | CREATE INDEX rbac_decision_logs_2026_09_request_id_idx ON public.rbac_decision_logs_2026_09 USING btree (request_id) |  |
| rbac_decision_logs_2026_09 | rbac_decision_logs_2026_09_resource_action_created_at_idx | false | false | btree | CREATE INDEX rbac_decision_logs_2026_09_resource_action_created_at_idx ON public.rbac_decision_logs_2026_09 USING btree (resource, action, created_at) |  |
| rbac_decision_logs_2026_09 | rbac_decision_logs_2026_09_role_id_created_at_idx | false | false | btree | CREATE INDEX rbac_decision_logs_2026_09_role_id_created_at_idx ON public.rbac_decision_logs_2026_09 USING btree (role_id, created_at) |  |
| rbac_decision_logs_2026_09 | rbac_decision_logs_2026_09_tenant_id_created_at_idx | false | false | btree | CREATE INDEX rbac_decision_logs_2026_09_tenant_id_created_at_idx ON public.rbac_decision_logs_2026_09 USING btree (tenant_id, created_at) |  |
| rbac_decision_logs_2026_09 | rbac_decision_logs_2026_09_user_id_created_at_idx | false | false | btree | CREATE INDEX rbac_decision_logs_2026_09_user_id_created_at_idx ON public.rbac_decision_logs_2026_09 USING btree (user_id, created_at) |  |
| rbac_decision_logs_2026_10 | rbac_decision_logs_2026_10_comparison_result_created_at_idx | false | false | btree | CREATE INDEX rbac_decision_logs_2026_10_comparison_result_created_at_idx ON public.rbac_decision_logs_2026_10 USING btree (comparison_result, created_at) |  |
| rbac_decision_logs_2026_10 | rbac_decision_logs_2026_10_created_at_idx | false | false | btree | CREATE INDEX rbac_decision_logs_2026_10_created_at_idx ON public.rbac_decision_logs_2026_10 USING btree (created_at) |  |
| rbac_decision_logs_2026_10 | rbac_decision_logs_2026_10_pkey | true | true | btree | CREATE UNIQUE INDEX rbac_decision_logs_2026_10_pkey ON public.rbac_decision_logs_2026_10 USING btree (id, created_at) |  |
| rbac_decision_logs_2026_10 | rbac_decision_logs_2026_10_request_id_idx | false | false | btree | CREATE INDEX rbac_decision_logs_2026_10_request_id_idx ON public.rbac_decision_logs_2026_10 USING btree (request_id) |  |
| rbac_decision_logs_2026_10 | rbac_decision_logs_2026_10_resource_action_created_at_idx | false | false | btree | CREATE INDEX rbac_decision_logs_2026_10_resource_action_created_at_idx ON public.rbac_decision_logs_2026_10 USING btree (resource, action, created_at) |  |
| rbac_decision_logs_2026_10 | rbac_decision_logs_2026_10_role_id_created_at_idx | false | false | btree | CREATE INDEX rbac_decision_logs_2026_10_role_id_created_at_idx ON public.rbac_decision_logs_2026_10 USING btree (role_id, created_at) |  |
| rbac_decision_logs_2026_10 | rbac_decision_logs_2026_10_tenant_id_created_at_idx | false | false | btree | CREATE INDEX rbac_decision_logs_2026_10_tenant_id_created_at_idx ON public.rbac_decision_logs_2026_10 USING btree (tenant_id, created_at) |  |
| rbac_decision_logs_2026_10 | rbac_decision_logs_2026_10_user_id_created_at_idx | false | false | btree | CREATE INDEX rbac_decision_logs_2026_10_user_id_created_at_idx ON public.rbac_decision_logs_2026_10 USING btree (user_id, created_at) |  |
| rbac_decision_logs_default | rbac_decision_logs_default_comparison_result_created_at_idx | false | false | btree | CREATE INDEX rbac_decision_logs_default_comparison_result_created_at_idx ON public.rbac_decision_logs_default USING btree (comparison_result, created_at) |  |
| rbac_decision_logs_default | rbac_decision_logs_default_created_at_idx | false | false | btree | CREATE INDEX rbac_decision_logs_default_created_at_idx ON public.rbac_decision_logs_default USING btree (created_at) |  |
| rbac_decision_logs_default | rbac_decision_logs_default_pkey | true | true | btree | CREATE UNIQUE INDEX rbac_decision_logs_default_pkey ON public.rbac_decision_logs_default USING btree (id, created_at) |  |
| rbac_decision_logs_default | rbac_decision_logs_default_request_id_idx | false | false | btree | CREATE INDEX rbac_decision_logs_default_request_id_idx ON public.rbac_decision_logs_default USING btree (request_id) |  |
| rbac_decision_logs_default | rbac_decision_logs_default_resource_action_created_at_idx | false | false | btree | CREATE INDEX rbac_decision_logs_default_resource_action_created_at_idx ON public.rbac_decision_logs_default USING btree (resource, action, created_at) |  |
| rbac_decision_logs_default | rbac_decision_logs_default_role_id_created_at_idx | false | false | btree | CREATE INDEX rbac_decision_logs_default_role_id_created_at_idx ON public.rbac_decision_logs_default USING btree (role_id, created_at) |  |
| rbac_decision_logs_default | rbac_decision_logs_default_tenant_id_created_at_idx | false | false | btree | CREATE INDEX rbac_decision_logs_default_tenant_id_created_at_idx ON public.rbac_decision_logs_default USING btree (tenant_id, created_at) |  |
| rbac_decision_logs_default | rbac_decision_logs_default_user_id_created_at_idx | false | false | btree | CREATE INDEX rbac_decision_logs_default_user_id_created_at_idx ON public.rbac_decision_logs_default USING btree (user_id, created_at) |  |
| rbac_error_logs | idx_rbac_error_logs_tenant | false | false | btree | CREATE INDEX idx_rbac_error_logs_tenant ON public.rbac_error_logs USING btree (tenant_id, created_at DESC) |  |
| rbac_error_logs | idx_rbac_error_logs_type_time | false | false | btree | CREATE INDEX idx_rbac_error_logs_type_time ON public.rbac_error_logs USING btree (error_type, created_at DESC) |  |
| rbac_error_logs | rbac_error_logs_pkey | true | true | btree | CREATE UNIQUE INDEX rbac_error_logs_pkey ON public.rbac_error_logs USING btree (id) |  |
| release_works | IDX_release_works_release | false | false | btree | CREATE INDEX "IDX_release_works_release" ON public.release_works USING btree (release_id) |  |
| release_works | IDX_release_works_work | false | false | btree | CREATE INDEX "IDX_release_works_work" ON public.release_works USING btree (work_id) |  |
| release_works | PK_release_works | true | true | btree | CREATE UNIQUE INDEX "PK_release_works" ON public.release_works USING btree (release_id, work_id) |  |
| releases | idx_releases_artista_id | false | false | btree | CREATE INDEX idx_releases_artista_id ON public.releases USING btree (artista_id) |  |
| releases | idx_releases_tenant_active | false | false | btree | CREATE INDEX idx_releases_tenant_active ON public.releases USING btree (tenant_id, deleted_at, created_at DESC) WHERE (deleted_at IS NULL) | (deleted_at IS NULL) |
| releases | idx_releases_tenant_id | false | false | btree | CREATE INDEX idx_releases_tenant_id ON public.releases USING btree (tenant_id) |  |
| releases | releases_pkey | true | true | btree | CREATE UNIQUE INDEX releases_pkey ON public.releases USING btree (id) |  |
| releases | uq_releases_tenant_id_id | true | false | btree | CREATE UNIQUE INDEX uq_releases_tenant_id_id ON public.releases USING btree (tenant_id, id) |  |
| rights_holders | idx_rights_holders_tenant | false | false | btree | CREATE INDEX idx_rights_holders_tenant ON public.rights_holders USING btree (tenant_id) |  |
| rights_holders | idx_rights_holders_type | false | false | btree | CREATE INDEX idx_rights_holders_type ON public.rights_holders USING btree (tenant_id, holder_type) |  |
| rights_holders | rights_holders_pkey | true | true | btree | CREATE UNIQUE INDEX rights_holders_pkey ON public.rights_holders USING btree (id) |  |
| rights_holders | uq_rights_holders_tenant_doc | true | false | btree | CREATE UNIQUE INDEX uq_rights_holders_tenant_doc ON public.rights_holders USING btree (tenant_id, document_number) WHERE ((document_number IS NOT NULL) AND (deleted_at IS NULL)) | ((document_number IS NOT NULL) AND (deleted_at IS NULL)) |
| role_inheritance | idx_role_inheritance_active_tenant_child | false | false | btree | CREATE INDEX idx_role_inheritance_active_tenant_child ON public.role_inheritance USING btree (tenant_id, child_role_id) WHERE (deleted_at IS NULL) | (deleted_at IS NULL) |
| role_inheritance | idx_role_inheritance_active_tenant_parent | false | false | btree | CREATE INDEX idx_role_inheritance_active_tenant_parent ON public.role_inheritance USING btree (tenant_id, parent_role_id) WHERE (deleted_at IS NULL) | (deleted_at IS NULL) |
| role_inheritance | idx_role_inheritance_child_role_id | false | false | btree | CREATE INDEX idx_role_inheritance_child_role_id ON public.role_inheritance USING btree (child_role_id) |  |
| role_inheritance | idx_role_inheritance_parent_role_id | false | false | btree | CREATE INDEX idx_role_inheritance_parent_role_id ON public.role_inheritance USING btree (parent_role_id) |  |
| role_inheritance | idx_role_inheritance_tenant_id | false | false | btree | CREATE INDEX idx_role_inheritance_tenant_id ON public.role_inheritance USING btree (tenant_id) |  |
| role_inheritance | role_inheritance_pkey | true | true | btree | CREATE UNIQUE INDEX role_inheritance_pkey ON public.role_inheritance USING btree (id) |  |
| role_inheritance | uq_role_inheritance_active_pair | true | false | btree | CREATE UNIQUE INDEX uq_role_inheritance_active_pair ON public.role_inheritance USING btree (child_role_id, parent_role_id) WHERE (deleted_at IS NULL) | (deleted_at IS NULL) |
| role_permissions | idx_rp_permission | false | false | btree | CREATE INDEX idx_rp_permission ON public.role_permissions USING btree (permission_id) |  |
| role_permissions | role_permissions_pkey | true | true | btree | CREATE UNIQUE INDEX role_permissions_pkey ON public.role_permissions USING btree (id) |  |
| role_permissions | uq_role_permissions | true | false | btree | CREATE UNIQUE INDEX uq_role_permissions ON public.role_permissions USING btree (role_id, permission_id) |  |
| role_template_permissions | idx_role_template_permissions_permission_id | false | false | btree | CREATE INDEX idx_role_template_permissions_permission_id ON public.role_template_permissions USING btree (permission_id) |  |
| role_template_permissions | idx_role_template_permissions_template_id | false | false | btree | CREATE INDEX idx_role_template_permissions_template_id ON public.role_template_permissions USING btree (template_id) |  |
| role_template_permissions | role_template_permissions_pkey | true | true | btree | CREATE UNIQUE INDEX role_template_permissions_pkey ON public.role_template_permissions USING btree (id) |  |
| role_template_permissions | uq_role_template_permissions_template_permission | true | false | btree | CREATE UNIQUE INDEX uq_role_template_permissions_template_permission ON public.role_template_permissions USING btree (template_id, permission_id) |  |
| role_templates | idx_role_templates_deleted_at | false | false | btree | CREATE INDEX idx_role_templates_deleted_at ON public.role_templates USING btree (deleted_at) |  |
| role_templates | role_templates_pkey | true | true | btree | CREATE UNIQUE INDEX role_templates_pkey ON public.role_templates USING btree (id) |  |
| role_templates | uq_role_templates_key | true | false | btree | CREATE UNIQUE INDEX uq_role_templates_key ON public.role_templates USING btree (key) |  |
| roles | idx_roles_archived_at | false | false | btree | CREATE INDEX idx_roles_archived_at ON public.roles USING btree (archived_at) |  |
| roles | idx_roles_created_by | false | false | btree | CREATE INDEX idx_roles_created_by ON public.roles USING btree (created_by) |  |
| roles | idx_roles_hierarchy | false | false | btree | CREATE INDEX idx_roles_hierarchy ON public.roles USING btree (hierarchy_level) |  |
| roles | idx_roles_is_system | false | false | btree | CREATE INDEX idx_roles_is_system ON public.roles USING btree (is_system) |  |
| roles | idx_roles_tenant_id | false | false | btree | CREATE INDEX idx_roles_tenant_id ON public.roles USING btree (tenant_id) |  |
| roles | idx_roles_updated_by | false | false | btree | CREATE INDEX idx_roles_updated_by ON public.roles USING btree (updated_by) |  |
| roles | roles_pkey | true | true | btree | CREATE UNIQUE INDEX roles_pkey ON public.roles USING btree (id) |  |
| roles | uq_roles_global_slug | true | false | btree | CREATE UNIQUE INDEX uq_roles_global_slug ON public.roles USING btree (slug) WHERE ((tenant_id IS NULL) AND (deleted_at IS NULL)) | ((tenant_id IS NULL) AND (deleted_at IS NULL)) |
| roles | uq_roles_tenant_slug | true | false | btree | CREATE UNIQUE INDEX uq_roles_tenant_slug ON public.roles USING btree (tenant_id, slug) WHERE ((tenant_id IS NOT NULL) AND (deleted_at IS NULL)) | ((tenant_id IS NOT NULL) AND (deleted_at IS NULL)) |
| shares | idx_shares_obra_id | false | false | btree | CREATE INDEX idx_shares_obra_id ON public.shares USING btree (obra_id) |  |
| shares | idx_shares_publisher | false | false | btree | CREATE INDEX idx_shares_publisher ON public.shares USING btree (publisher_id) |  |
| shares | idx_shares_rights_holder | false | false | btree | CREATE INDEX idx_shares_rights_holder ON public.shares USING btree (rights_holder_id) |  |
| shares | idx_shares_tenant_id | false | false | btree | CREATE INDEX idx_shares_tenant_id ON public.shares USING btree (tenant_id) |  |
| shares | shares_pkey | true | true | btree | CREATE UNIQUE INDEX shares_pkey ON public.shares USING btree (id) |  |
| skill_run_logs | idx_skill_run_logs_run | false | false | btree | CREATE INDEX idx_skill_run_logs_run ON public.skill_run_logs USING btree (skill_run_id) |  |
| skill_run_logs | idx_skill_run_logs_run_level | false | false | btree | CREATE INDEX idx_skill_run_logs_run_level ON public.skill_run_logs USING btree (skill_run_id, level) |  |
| skill_run_logs | skill_run_logs_pkey | true | true | btree | CREATE UNIQUE INDEX skill_run_logs_pkey ON public.skill_run_logs USING btree (id) |  |
| skill_runs | idx_skill_runs_correlation | false | false | btree | CREATE INDEX idx_skill_runs_correlation ON public.skill_runs USING btree (correlation_id) |  |
| skill_runs | idx_skill_runs_entity | false | false | btree | CREATE INDEX idx_skill_runs_entity ON public.skill_runs USING btree (entity_type, entity_id) |  |
| skill_runs | idx_skill_runs_tenant | false | false | btree | CREATE INDEX idx_skill_runs_tenant ON public.skill_runs USING btree (tenant_id) |  |
| skill_runs | idx_skill_runs_tenant_name | false | false | btree | CREATE INDEX idx_skill_runs_tenant_name ON public.skill_runs USING btree (tenant_id, skill_name) |  |
| skill_runs | idx_skill_runs_tenant_status | false | false | btree | CREATE INDEX idx_skill_runs_tenant_status ON public.skill_runs USING btree (tenant_id, status) |  |
| skill_runs | skill_runs_pkey | true | true | btree | CREATE UNIQUE INDEX skill_runs_pkey ON public.skill_runs USING btree (id) |  |
| society_accounts | idx_society_accounts_society | false | false | btree | CREATE INDEX idx_society_accounts_society ON public.society_accounts USING btree (tenant_id, society) |  |
| society_accounts | idx_society_accounts_tenant | false | false | btree | CREATE INDEX idx_society_accounts_tenant ON public.society_accounts USING btree (tenant_id) |  |
| society_accounts | society_accounts_pkey | true | true | btree | CREATE UNIQUE INDEX society_accounts_pkey ON public.society_accounts USING btree (id) |  |
| society_payload_snapshots | idx_society_snapshots_submission | false | false | btree | CREATE INDEX idx_society_snapshots_submission ON public.society_payload_snapshots USING btree (submission_id) |  |
| society_payload_snapshots | idx_society_snapshots_tenant | false | false | btree | CREATE INDEX idx_society_snapshots_tenant ON public.society_payload_snapshots USING btree (tenant_id) |  |
| society_payload_snapshots | society_payload_snapshots_pkey | true | true | btree | CREATE UNIQUE INDEX society_payload_snapshots_pkey ON public.society_payload_snapshots USING btree (id) |  |
| society_payload_snapshots | uq_society_snapshot_version | true | false | btree | CREATE UNIQUE INDEX uq_society_snapshot_version ON public.society_payload_snapshots USING btree (submission_id, version) |  |
| society_submission_events | idx_society_events_submission | false | false | btree | CREATE INDEX idx_society_events_submission ON public.society_submission_events USING btree (submission_id) |  |
| society_submission_events | idx_society_events_tenant | false | false | btree | CREATE INDEX idx_society_events_tenant ON public.society_submission_events USING btree (tenant_id) |  |
| society_submission_events | society_submission_events_pkey | true | true | btree | CREATE UNIQUE INDEX society_submission_events_pkey ON public.society_submission_events USING btree (id) |  |
| society_submissions | idx_society_submissions_entity | false | false | btree | CREATE INDEX idx_society_submissions_entity ON public.society_submissions USING btree (tenant_id, entity_type, entity_id) |  |
| society_submissions | idx_society_submissions_status | false | false | btree | CREATE INDEX idx_society_submissions_status ON public.society_submissions USING btree (tenant_id, status) |  |
| society_submissions | idx_society_submissions_tenant | false | false | btree | CREATE INDEX idx_society_submissions_tenant ON public.society_submissions USING btree (tenant_id) |  |
| society_submissions | society_submissions_pkey | true | true | btree | CREATE UNIQUE INDEX society_submissions_pkey ON public.society_submissions USING btree (id) |  |
| society_submissions | uq_society_submissions_protocol | true | false | btree | CREATE UNIQUE INDEX uq_society_submissions_protocol ON public.society_submissions USING btree (tenant_id, society, protocol) WHERE (protocol IS NOT NULL) | (protocol IS NOT NULL) |
| society_sync_jobs | idx_society_sync_status | false | false | btree | CREATE INDEX idx_society_sync_status ON public.society_sync_jobs USING btree (tenant_id, status) |  |
| society_sync_jobs | idx_society_sync_tenant | false | false | btree | CREATE INDEX idx_society_sync_tenant ON public.society_sync_jobs USING btree (tenant_id) |  |
| society_sync_jobs | society_sync_jobs_pkey | true | true | btree | CREATE UNIQUE INDEX society_sync_jobs_pkey ON public.society_sync_jobs USING btree (id) |  |
| society_validation_errors | idx_society_valerr_entity | false | false | btree | CREATE INDEX idx_society_valerr_entity ON public.society_validation_errors USING btree (tenant_id, entity_type, entity_id) |  |
| society_validation_errors | idx_society_valerr_submission | false | false | btree | CREATE INDEX idx_society_valerr_submission ON public.society_validation_errors USING btree (submission_id) |  |
| society_validation_errors | idx_society_valerr_tenant | false | false | btree | CREATE INDEX idx_society_valerr_tenant ON public.society_validation_errors USING btree (tenant_id) |  |
| society_validation_errors | society_validation_errors_pkey | true | true | btree | CREATE UNIQUE INDEX society_validation_errors_pkey ON public.society_validation_errors USING btree (id) |  |
| support_tickets | idx_support_tickets_status | false | false | btree | CREATE INDEX idx_support_tickets_status ON public.support_tickets USING btree (status) |  |
| support_tickets | idx_support_tickets_tenant | false | false | btree | CREATE INDEX idx_support_tickets_tenant ON public.support_tickets USING btree (tenant_id) |  |
| support_tickets | idx_support_tickets_tenant_active | false | false | btree | CREATE INDEX idx_support_tickets_tenant_active ON public.support_tickets USING btree (tenant_id, deleted_at, created_at DESC) WHERE (deleted_at IS NULL) | (deleted_at IS NULL) |
| support_tickets | support_tickets_pkey | true | true | btree | CREATE UNIQUE INDEX support_tickets_pkey ON public.support_tickets USING btree (id) |  |
| support_tickets | support_tickets_ticket_number_key | true | false | btree | CREATE UNIQUE INDEX support_tickets_ticket_number_key ON public.support_tickets USING btree (ticket_number) |  |
| takedowns | idx_takedowns_tenant_id | false | false | btree | CREATE INDEX idx_takedowns_tenant_id ON public.takedowns USING btree (tenant_id) |  |
| takedowns | idx_takedowns_tenant_status | false | false | btree | CREATE INDEX idx_takedowns_tenant_status ON public.takedowns USING btree (tenant_id, status) |  |
| takedowns | takedowns_pkey | true | true | btree | CREATE UNIQUE INDEX takedowns_pkey ON public.takedowns USING btree (id) |  |
| task_assets | idx_task_assets_task | false | false | btree | CREATE INDEX idx_task_assets_task ON public.task_assets USING btree (tenant_id, task_id) |  |
| task_assets | idx_task_assets_tenant | false | false | btree | CREATE INDEX idx_task_assets_tenant ON public.task_assets USING btree (tenant_id) |  |
| task_assets | task_assets_pkey | true | true | btree | CREATE UNIQUE INDEX task_assets_pkey ON public.task_assets USING btree (id) |  |
| task_assets | uq_task_assets_task_asset | true | false | btree | CREATE UNIQUE INDEX uq_task_assets_task_asset ON public.task_assets USING btree (tenant_id, task_id, asset_id) |  |
| tenant_billing_state | idx_tenant_billing_state_status | false | false | btree | CREATE INDEX idx_tenant_billing_state_status ON public.tenant_billing_state USING btree (status) |  |
| tenant_billing_state | tenant_billing_state_pkey | true | true | btree | CREATE UNIQUE INDEX tenant_billing_state_pkey ON public.tenant_billing_state USING btree (id) |  |
| tenant_billing_state | tenant_billing_state_tenant_id_key | true | false | btree | CREATE UNIQUE INDEX tenant_billing_state_tenant_id_key ON public.tenant_billing_state USING btree (tenant_id) |  |
| tenant_invitations | idx_tenant_invitations_tenant_status | false | false | btree | CREATE INDEX idx_tenant_invitations_tenant_status ON public.tenant_invitations USING btree (tenant_id, status, created_at DESC) |  |
| tenant_invitations | tenant_invitations_pkey | true | true | btree | CREATE UNIQUE INDEX tenant_invitations_pkey ON public.tenant_invitations USING btree (id) |  |
| tenant_invitations | uq_tenant_invitations_pending_email | true | false | btree | CREATE UNIQUE INDEX uq_tenant_invitations_pending_email ON public.tenant_invitations USING btree (tenant_id, lower((email)::text)) WHERE ((status)::text = 'pending'::text) | ((status)::text = 'pending'::text) |
| tenants | idx_tenants_org_id | false | false | btree | CREATE INDEX idx_tenants_org_id ON public.tenants USING btree (org_id) |  |
| tenants | idx_tenants_slug | false | false | btree | CREATE INDEX idx_tenants_slug ON public.tenants USING btree (slug) |  |
| tenants | tenant_external_auth_idx | false | false | btree | CREATE INDEX tenant_external_auth_idx ON public.tenants USING btree (external_auth_org_id) |  |
| tenants | tenants_external_auth_org_id_key | true | false | btree | CREATE UNIQUE INDEX tenants_external_auth_org_id_key ON public.tenants USING btree (external_auth_org_id) |  |
| tenants | tenants_pkey | true | true | btree | CREATE UNIQUE INDEX tenants_pkey ON public.tenants USING btree (id) |  |
| tenants | tenants_single_system_tenant | true | false | btree | CREATE UNIQUE INDEX tenants_single_system_tenant ON public.tenants USING btree (is_system_tenant) WHERE (is_system_tenant = true) | (is_system_tenant = true) |
| tenants | tenants_slug_key | true | false | btree | CREATE UNIQUE INDEX tenants_slug_key ON public.tenants USING btree (slug) |  |
| transaction_allocations | idx_txalloc_tenant_artist | false | false | btree | CREATE INDEX idx_txalloc_tenant_artist ON public.transaction_allocations USING btree (tenant_id, dimension, artist_id) |  |
| transaction_allocations | idx_txalloc_tenant_phonogram | false | false | btree | CREATE INDEX idx_txalloc_tenant_phonogram ON public.transaction_allocations USING btree (tenant_id, dimension, phonogram_id) |  |
| transaction_allocations | idx_txalloc_tenant_project | false | false | btree | CREATE INDEX idx_txalloc_tenant_project ON public.transaction_allocations USING btree (tenant_id, dimension, project_id) |  |
| transaction_allocations | idx_txalloc_tenant_release | false | false | btree | CREATE INDEX idx_txalloc_tenant_release ON public.transaction_allocations USING btree (tenant_id, dimension, release_id) |  |
| transaction_allocations | idx_txalloc_tenant_transaction | false | false | btree | CREATE INDEX idx_txalloc_tenant_transaction ON public.transaction_allocations USING btree (tenant_id, transaction_id) |  |
| transaction_allocations | transaction_allocations_pkey | true | true | btree | CREATE UNIQUE INDEX transaction_allocations_pkey ON public.transaction_allocations USING btree (id) |  |
| transaction_allocations | uq_transaction_allocations_tenant_id_id | true | false | btree | CREATE UNIQUE INDEX uq_transaction_allocations_tenant_id_id ON public.transaction_allocations USING btree (tenant_id, id) |  |
| transaction_allocations | uq_txalloc_target_per_dimension | true | false | btree | CREATE UNIQUE INDEX uq_txalloc_target_per_dimension ON public.transaction_allocations USING btree (tenant_id, transaction_id, dimension, project_id, artist_id, phonogram_id, release_id) NULLS NOT DISTINCT |  |
| transactions | idx_transactions_artista_id | false | false | btree | CREATE INDEX idx_transactions_artista_id ON public.transactions USING btree (artista_id) |  |
| transactions | idx_transactions_financial_category | false | false | btree | CREATE INDEX idx_transactions_financial_category ON public.transactions USING btree (tenant_id, financial_category_id) |  |
| transactions | idx_transactions_tenant_active | false | false | btree | CREATE INDEX idx_transactions_tenant_active ON public.transactions USING btree (tenant_id, deleted_at, created_at DESC) WHERE (deleted_at IS NULL) | (deleted_at IS NULL) |
| transactions | idx_transactions_tenant_data | false | false | btree | CREATE INDEX idx_transactions_tenant_data ON public.transactions USING btree (tenant_id, data) |  |
| transactions | idx_transactions_tenant_id | false | false | btree | CREATE INDEX idx_transactions_tenant_id ON public.transactions USING btree (tenant_id) |  |
| transactions | idx_transactions_tipo | false | false | btree | CREATE INDEX idx_transactions_tipo ON public.transactions USING btree (tenant_id, tipo) WHERE (deleted_at IS NULL) | (deleted_at IS NULL) |
| transactions | transactions_pkey | true | true | btree | CREATE UNIQUE INDEX transactions_pkey ON public.transactions USING btree (id) |  |
| uploads | idx_uploads_entity | false | false | btree | CREATE INDEX idx_uploads_entity ON public.uploads USING btree (entity, entity_id) |  |
| uploads | idx_uploads_file_id | false | false | btree | CREATE INDEX idx_uploads_file_id ON public.uploads USING btree (file_id) |  |
| uploads | idx_uploads_tenant_active | false | false | btree | CREATE INDEX idx_uploads_tenant_active ON public.uploads USING btree (tenant_id, deleted_at, created_at DESC) WHERE (deleted_at IS NULL) | (deleted_at IS NULL) |
| uploads | idx_uploads_tenant_id | false | false | btree | CREATE INDEX idx_uploads_tenant_id ON public.uploads USING btree (tenant_id) |  |
| uploads | uploads_file_id_key | true | false | btree | CREATE UNIQUE INDEX uploads_file_id_key ON public.uploads USING btree (file_id) |  |
| uploads | uploads_pkey | true | true | btree | CREATE UNIQUE INDEX uploads_pkey ON public.uploads USING btree (id) |  |
| users | uq_users_auth_user_id | true | false | btree | CREATE UNIQUE INDEX uq_users_auth_user_id ON public.users USING btree (auth_user_id) |  |
| users | users_pkey | true | true | btree | CREATE UNIQUE INDEX users_pkey ON public.users USING btree (id) |  |
| webhook_events | idx_webhook_events_pending | false | false | btree | CREATE INDEX idx_webhook_events_pending ON public.webhook_events USING btree (provider, status, created_at) WHERE ((status)::text = ANY ((ARRAY['pending'::character varying, 'failed'::character varying])::text[])) | ((status)::text = ANY ((ARRAY['pending'::character varying, 'failed'::character varying])::text[])) |
| webhook_events | idx_webhook_events_provider | false | false | btree | CREATE INDEX idx_webhook_events_provider ON public.webhook_events USING btree (provider, event_type) |  |
| webhook_events | idx_webhook_events_status | false | false | btree | CREATE INDEX idx_webhook_events_status ON public.webhook_events USING btree (status) |  |
| webhook_events | webhook_events_external_id_key | true | false | btree | CREATE UNIQUE INDEX webhook_events_external_id_key ON public.webhook_events USING btree (external_id) |  |
| webhook_events | webhook_events_pkey | true | true | btree | CREATE UNIQUE INDEX webhook_events_pkey ON public.webhook_events USING btree (id) |  |
| work_participants | idx_work_participants_tenant_work | false | false | btree | CREATE INDEX idx_work_participants_tenant_work ON public.work_participants USING btree (tenant_id, work_id) |  |
| work_participants | work_participants_pkey | true | true | btree | CREATE UNIQUE INDEX work_participants_pkey ON public.work_participants USING btree (id) |  |
| workflow_execution_logs | idx_wf_exec_logs_exec | false | false | btree | CREATE INDEX idx_wf_exec_logs_exec ON public.workflow_execution_logs USING btree (execution_id) |  |
| workflow_execution_logs | workflow_execution_logs_pkey | true | true | btree | CREATE UNIQUE INDEX workflow_execution_logs_pkey ON public.workflow_execution_logs USING btree (id) |  |
| workflow_executions | idx_wf_exec_correlation | false | false | btree | CREATE INDEX idx_wf_exec_correlation ON public.workflow_executions USING btree (correlation_id) |  |
| workflow_executions | idx_wf_exec_event | false | false | btree | CREATE INDEX idx_wf_exec_event ON public.workflow_executions USING btree (event_type) |  |
| workflow_executions | idx_wf_exec_tenant | false | false | btree | CREATE INDEX idx_wf_exec_tenant ON public.workflow_executions USING btree (tenant_id) |  |
| workflow_executions | idx_wf_exec_tenant_rule | false | false | btree | CREATE INDEX idx_wf_exec_tenant_rule ON public.workflow_executions USING btree (tenant_id, rule_id) |  |
| workflow_executions | idx_wf_exec_tenant_status | false | false | btree | CREATE INDEX idx_wf_exec_tenant_status ON public.workflow_executions USING btree (tenant_id, status) |  |
| workflow_executions | workflow_executions_pkey | true | true | btree | CREATE UNIQUE INDEX workflow_executions_pkey ON public.workflow_executions USING btree (id) |  |
| workflow_transitions | IDX_wf_transitions_created_at | false | false | btree | CREATE INDEX "IDX_wf_transitions_created_at" ON public.workflow_transitions USING btree (created_at DESC) |  |
| workflow_transitions | IDX_wf_transitions_entity | false | false | btree | CREATE INDEX "IDX_wf_transitions_entity" ON public.workflow_transitions USING btree (entity_type, entity_id) |  |
| workflow_transitions | IDX_wf_transitions_tenant | false | false | btree | CREATE INDEX "IDX_wf_transitions_tenant" ON public.workflow_transitions USING btree (tenant_id) |  |
| workflow_transitions | IDX_wf_transitions_tenant_type_entity | false | false | btree | CREATE INDEX "IDX_wf_transitions_tenant_type_entity" ON public.workflow_transitions USING btree (tenant_id, entity_type, entity_id) |  |
| workflow_transitions | workflow_transitions_pkey | true | true | btree | CREATE UNIQUE INDEX workflow_transitions_pkey ON public.workflow_transitions USING btree (id) |  |
| works | idx_works_artista_id | false | false | btree | CREATE INDEX idx_works_artista_id ON public.works USING btree (artista_id) |  |
| works | idx_works_isrc | false | false | btree | CREATE INDEX idx_works_isrc ON public.works USING btree (isrc) |  |
| works | idx_works_iswc | false | false | btree | CREATE INDEX idx_works_iswc ON public.works USING btree (iswc) |  |
| works | idx_works_registry_status | false | false | btree | CREATE INDEX idx_works_registry_status ON public.works USING btree (tenant_id, registry_status) |  |
| works | idx_works_tenant_active | false | false | btree | CREATE INDEX idx_works_tenant_active ON public.works USING btree (tenant_id, deleted_at, created_at DESC) WHERE (deleted_at IS NULL) | (deleted_at IS NULL) |
| works | idx_works_tenant_id | false | false | btree | CREATE INDEX idx_works_tenant_id ON public.works USING btree (tenant_id) |  |
| works | idx_works_tenant_status | false | false | btree | CREATE INDEX idx_works_tenant_status ON public.works USING btree (tenant_id, status) |  |
| works | works_pkey | true | true | btree | CREATE UNIQUE INDEX works_pkey ON public.works USING btree (id) |  |

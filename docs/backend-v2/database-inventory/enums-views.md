> Historical record. Kept as recorded; not the current contract.

# Enums, Views e Materialized Views

## Enums (25 enums, 119 valores)

| SCHEMA | ENUM_NAME | VALUES_IN_ORDER |
|---|---|---|
| auth | aal_level | aal1, aal2, aal3 |
| auth | code_challenge_method | s256, plain |
| auth | factor_status | unverified, verified |
| auth | factor_type | totp, webauthn, phone |
| auth | oauth_authorization_status | pending, approved, denied, expired |
| auth | oauth_client_type | public, confidential |
| auth | oauth_registration_type | dynamic, manual |
| auth | oauth_response_type | code |
| auth | one_time_token_type | confirmation_token, reauthentication_token, recovery_token, email_change_token_new, email_change_token_current, phone_change_token |
| public | account_type | bank, cash, digital_wallet, payment_provider, aggregator |
| public | allocation_dimension | project, artist, phonogram, release |
| public | category_nature | revenue, revenue_deduction, direct_cost, operating_expense, non_operational |
| public | conversation_channel | internal, email, whatsapp, telegram, instagram, sms, discord, facebook, tiktok, custom |
| public | conversation_status | open, pending, closed, spam |
| public | counterparty_type | client, supplier, artist, producer, publisher, distributor, aggregator, employee, collecting_agency, other |
| public | form_status | draft, active, archived |
| public | installment_interval | weekly, biweekly, monthly, quarterly, yearly |
| public | message_sender_type | user, contact, system, ai |
| public | metric_source | manual, import, api |
| public | performance_metric_type | streams, plays, views, downloads, saves, listeners, playlist_additions, watch_time, impressions, reach, followers, subscribers, monthly_listeners |
| public | transaction_status | pending, settled, cancelled, reversed |
| public | transaction_type | revenue, expense, transfer |
| realtime | action | INSERT, UPDATE, DELETE, TRUNCATE, ERROR |
| realtime | equality_op | eq, neq, lt, lte, gt, gte, in, like, ilike, is, match, imatch, isdistinct |
| storage | buckettype | STANDARD, ANALYTICS, VECTOR |

## Views (146)

| SCHEMA | NAME |
|---|---|
| extensions | pg_stat_statements |
| extensions | pg_stat_statements_info |
| information_schema | _pg_foreign_data_wrappers |
| information_schema | _pg_foreign_servers |
| information_schema | _pg_foreign_table_columns |
| information_schema | _pg_foreign_tables |
| information_schema | _pg_user_mappings |
| information_schema | administrable_role_authorizations |
| information_schema | applicable_roles |
| information_schema | attributes |
| information_schema | character_sets |
| information_schema | check_constraint_routine_usage |
| information_schema | check_constraints |
| information_schema | collation_character_set_applicability |
| information_schema | collations |
| information_schema | column_column_usage |
| information_schema | column_domain_usage |
| information_schema | column_options |
| information_schema | column_privileges |
| information_schema | column_udt_usage |
| information_schema | columns |
| information_schema | constraint_column_usage |
| information_schema | constraint_table_usage |
| information_schema | data_type_privileges |
| information_schema | domain_constraints |
| information_schema | domain_udt_usage |
| information_schema | domains |
| information_schema | element_types |
| information_schema | enabled_roles |
| information_schema | foreign_data_wrapper_options |
| information_schema | foreign_data_wrappers |
| information_schema | foreign_server_options |
| information_schema | foreign_servers |
| information_schema | foreign_table_options |
| information_schema | foreign_tables |
| information_schema | information_schema_catalog_name |
| information_schema | key_column_usage |
| information_schema | parameters |
| information_schema | referential_constraints |
| information_schema | role_column_grants |
| information_schema | role_routine_grants |
| information_schema | role_table_grants |
| information_schema | role_udt_grants |
| information_schema | role_usage_grants |
| information_schema | routine_column_usage |
| information_schema | routine_privileges |
| information_schema | routine_routine_usage |
| information_schema | routine_sequence_usage |
| information_schema | routine_table_usage |
| information_schema | routines |
| information_schema | schemata |
| information_schema | sequences |
| information_schema | table_constraints |
| information_schema | table_privileges |
| information_schema | tables |
| information_schema | transforms |
| information_schema | triggered_update_columns |
| information_schema | triggers |
| information_schema | udt_privileges |
| information_schema | usage_privileges |
| information_schema | user_defined_types |
| information_schema | user_mapping_options |
| information_schema | user_mappings |
| information_schema | view_column_usage |
| information_schema | view_routine_usage |
| information_schema | view_table_usage |
| information_schema | views |
| pg_catalog | pg_available_extension_versions |
| pg_catalog | pg_available_extensions |
| pg_catalog | pg_backend_memory_contexts |
| pg_catalog | pg_config |
| pg_catalog | pg_cursors |
| pg_catalog | pg_file_settings |
| pg_catalog | pg_group |
| pg_catalog | pg_hba_file_rules |
| pg_catalog | pg_ident_file_mappings |
| pg_catalog | pg_indexes |
| pg_catalog | pg_locks |
| pg_catalog | pg_matviews |
| pg_catalog | pg_policies |
| pg_catalog | pg_prepared_statements |
| pg_catalog | pg_prepared_xacts |
| pg_catalog | pg_publication_tables |
| pg_catalog | pg_replication_origin_status |
| pg_catalog | pg_replication_slots |
| pg_catalog | pg_roles |
| pg_catalog | pg_rules |
| pg_catalog | pg_seclabels |
| pg_catalog | pg_sequences |
| pg_catalog | pg_settings |
| pg_catalog | pg_shadow |
| pg_catalog | pg_shmem_allocations |
| pg_catalog | pg_stat_activity |
| pg_catalog | pg_stat_all_indexes |
| pg_catalog | pg_stat_all_tables |
| pg_catalog | pg_stat_archiver |
| pg_catalog | pg_stat_bgwriter |
| pg_catalog | pg_stat_checkpointer |
| pg_catalog | pg_stat_database |
| pg_catalog | pg_stat_database_conflicts |
| pg_catalog | pg_stat_gssapi |
| pg_catalog | pg_stat_io |
| pg_catalog | pg_stat_progress_analyze |
| pg_catalog | pg_stat_progress_basebackup |
| pg_catalog | pg_stat_progress_cluster |
| pg_catalog | pg_stat_progress_copy |
| pg_catalog | pg_stat_progress_create_index |
| pg_catalog | pg_stat_progress_vacuum |
| pg_catalog | pg_stat_recovery_prefetch |
| pg_catalog | pg_stat_replication |
| pg_catalog | pg_stat_replication_slots |
| pg_catalog | pg_stat_slru |
| pg_catalog | pg_stat_ssl |
| pg_catalog | pg_stat_subscription |
| pg_catalog | pg_stat_subscription_stats |
| pg_catalog | pg_stat_sys_indexes |
| pg_catalog | pg_stat_sys_tables |
| pg_catalog | pg_stat_user_functions |
| pg_catalog | pg_stat_user_indexes |
| pg_catalog | pg_stat_user_tables |
| pg_catalog | pg_stat_wal |
| pg_catalog | pg_stat_wal_receiver |
| pg_catalog | pg_stat_xact_all_tables |
| pg_catalog | pg_stat_xact_sys_tables |
| pg_catalog | pg_stat_xact_user_functions |
| pg_catalog | pg_stat_xact_user_tables |
| pg_catalog | pg_statio_all_indexes |
| pg_catalog | pg_statio_all_sequences |
| pg_catalog | pg_statio_all_tables |
| pg_catalog | pg_statio_sys_indexes |
| pg_catalog | pg_statio_sys_sequences |
| pg_catalog | pg_statio_sys_tables |
| pg_catalog | pg_statio_user_indexes |
| pg_catalog | pg_statio_user_sequences |
| pg_catalog | pg_statio_user_tables |
| pg_catalog | pg_stats |
| pg_catalog | pg_stats_ext |
| pg_catalog | pg_stats_ext_exprs |
| pg_catalog | pg_tables |
| pg_catalog | pg_timezone_abbrevs |
| pg_catalog | pg_timezone_names |
| pg_catalog | pg_user |
| pg_catalog | pg_user_mappings |
| pg_catalog | pg_views |
| pg_catalog | pg_wait_events |
| vault | decrypted_secrets |

## Materialized Views (0)

Nenhuma materialized view encontrada.

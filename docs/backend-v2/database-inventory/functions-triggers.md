> Historical record. Kept as recorded; not the current contract.

# Functions e Triggers

## Functions — schema `public` (19)

| FUNCTION | ARGUMENTS | RETURN_TYPE | LANGUAGE | SECURITY_DEFINER | VOLATILITY |
|---|---|---|---|---|---|
| app_current_org_id |  | text | plpgsql | false | s |
| app_current_tenant_id |  | uuid | plpgsql | false | s |
| app_is_super_admin |  | boolean | plpgsql | false | s |
| app_jwt |  | jsonb | plpgsql | false | s |
| bump_role_inheritance_version |  | trigger | plpgsql | true | v |
| ensure_rbac_decision_log_partitions | reference_date date DEFAULT CURRENT_DATE, months_ahead integer DEFAULT 2 | void | plpgsql | true | v |
| fn_audit_logs_immutable |  | trigger | plpgsql | false | v |
| fn_budget_revisions_append_only |  | trigger | plpgsql | false | v |
| fn_financial_version_lock |  | trigger | plpgsql | false | v |
| fn_fincat_level_guard |  | trigger | plpgsql | false | v |
| fn_fintx_reversal_guard |  | trigger | plpgsql | false | v |
| fn_fintx_state_machine |  | trigger | plpgsql | false | v |
| fn_largest_remainder | p_amount numeric, p_percentages numeric[] | numeric[] | plpgsql | false | i |
| fn_metric_immutability |  | trigger | plpgsql | false | v |
| fn_txalloc_check_sums |  | trigger | plpgsql | false | v |
| guard_role_inheritance_global_delete |  | trigger | plpgsql | true | v |
| harden_rbac_decision_log_partition | target_table regclass | void | plpgsql | true | v |
| private_get_tenant_id |  | uuid | sql | false | s |
| validate_role_inheritance |  | trigger | plpgsql | true | v |

## Functions — outros schemas (129, resumo por schema)

| SCHEMA | COUNT | CLASSIFICATION |
|---|---|---|
| auth | 4 | SUPABASE_MANAGED |
| extensions | 86 | SUPABASE_MANAGED |
| graphql_public | 1 | SUPABASE_MANAGED |
| pgbouncer | 1 | SUPABASE_MANAGED |
| realtime | 15 | SUPABASE_MANAGED |
| storage | 17 | SUPABASE_MANAGED |
| vault | 5 | SUPABASE_MANAGED |

## Triggers — schema `public` (13)

| TABLE | TRIGGER_NAME | ENABLED | DEFINITION |
|---|---|---|---|
| audit_logs | trg_audit_logs_immutable | O | CREATE TRIGGER trg_audit_logs_immutable BEFORE DELETE OR UPDATE ON public.audit_logs FOR EACH ROW EXECUTE FUNCTION fn_audit_logs_immutable() |
| budget_revisions | trg_budget_revisions_append_only | O | CREATE TRIGGER trg_budget_revisions_append_only BEFORE DELETE OR UPDATE ON public.budget_revisions FOR EACH ROW EXECUTE FUNCTION fn_budget_revisions_append_only() |
| budgets | trg_budgets_version_lock | O | CREATE TRIGGER trg_budgets_version_lock BEFORE UPDATE ON public.budgets FOR EACH ROW EXECUTE FUNCTION fn_financial_version_lock() |
| financial_categories | trg_fincat_level_guard | O | CREATE TRIGGER trg_fincat_level_guard BEFORE INSERT OR UPDATE OF parent_id, level ON public.financial_categories FOR EACH ROW EXECUTE FUNCTION fn_fincat_level_guard() |
| financial_transactions | trg_fintx_reversal_guard | O | CREATE TRIGGER trg_fintx_reversal_guard BEFORE INSERT ON public.financial_transactions FOR EACH ROW WHEN ((new.reversal_of_id IS NOT NULL)) EXECUTE FUNCTION fn_fintx_reversal_guard() |
| financial_transactions | trg_fintx_state_machine | O | CREATE TRIGGER trg_fintx_state_machine BEFORE DELETE OR UPDATE ON public.financial_transactions FOR EACH ROW EXECUTE FUNCTION fn_fintx_state_machine() |
| financial_transactions | trg_fintx_version_lock | O | CREATE TRIGGER trg_fintx_version_lock BEFORE UPDATE ON public.financial_transactions FOR EACH ROW EXECUTE FUNCTION fn_financial_version_lock() |
| performance_metric_entries | trg_metric_immutability | O | CREATE TRIGGER trg_metric_immutability BEFORE DELETE OR UPDATE ON public.performance_metric_entries FOR EACH ROW EXECUTE FUNCTION fn_metric_immutability() |
| role_inheritance | trg_bump_role_inheritance_version | O | CREATE TRIGGER trg_bump_role_inheritance_version AFTER INSERT OR UPDATE OF child_role_id, parent_role_id, deleted_at ON public.role_inheritance FOR EACH ROW EXECUTE FUNCTION bump_role_inheritance_version() |
| role_inheritance | trg_guard_role_inheritance_global_delete | O | CREATE TRIGGER trg_guard_role_inheritance_global_delete BEFORE DELETE ON public.role_inheritance FOR EACH ROW EXECUTE FUNCTION guard_role_inheritance_global_delete() |
| role_inheritance | trg_validate_role_inheritance | O | CREATE TRIGGER trg_validate_role_inheritance BEFORE INSERT OR UPDATE ON public.role_inheritance FOR EACH ROW EXECUTE FUNCTION validate_role_inheritance() |
| transaction_allocations | trg_txalloc_check_sums | O | CREATE CONSTRAINT TRIGGER trg_txalloc_check_sums AFTER INSERT OR DELETE OR UPDATE ON public.transaction_allocations DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION fn_txalloc_check_sums() |
| transaction_allocations | trg_txalloc_version_lock | O | CREATE TRIGGER trg_txalloc_version_lock BEFORE UPDATE ON public.transaction_allocations FOR EACH ROW EXECUTE FUNCTION fn_financial_version_lock() |

## Triggers — outros schemas (5)

| SCHEMA | TABLE | TRIGGER_NAME | ENABLED |
|---|---|---|---|
| realtime | subscription | tr_check_filters | O |
| storage | buckets | enforce_bucket_name_length_trigger | O |
| storage | buckets | protect_buckets_delete | O |
| storage | objects | protect_objects_delete | O |
| storage | objects | update_objects_updated_at | O |

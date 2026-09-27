import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * PHASE 3V-B — Final harmonization batch: migrates the 15 legacy policies that use
 * `(tenant_id)::text = current_setting('app.current_tenant_id', true)` (MEDIUM_RISK
 * in PHASE 3U — they already have WITH CHECK and are ''-safe, but not portable) to the
 * official pattern:
 *
 *   USING      (tenant_id = private_get_tenant_id())
 *   WITH CHECK (tenant_id = private_get_tenant_id())
 *
 * Preserves the EXACT NAME of each policy (financial_* use tenant_isolation_<table>;
 * marketing_* use tenant_isolation). Does NOT change schema, data, enabled RLS nor
 * FORCE. Does NOT touch other policies nor the already completed batches (3V-A ::uuid).
 * Idempotent (DROP+CREATE) and reversible (down recreates the original RAW ::text form).
 */
export class HarmonizeRawTextPolicies20260613000015 implements MigrationInterface {
  name = 'HarmonizeRawTextPolicies20260613000015';

  // [table, policy_name]
  private static readonly SPECS: ReadonlyArray<[string, string]> = [
    ['financial_categories', 'tenant_isolation_financial_categories'],
    ['financial_category_audit_logs', 'tenant_isolation_financial_category_audit_logs'],
    ['financial_category_centers', 'tenant_isolation_financial_category_centers'],
    ['financial_category_favorites', 'tenant_isolation_financial_category_favorites'],
    ['financial_category_links', 'tenant_isolation_financial_category_links'],
    ['financial_category_rule_runs', 'tenant_isolation_financial_category_rule_runs'],
    ['financial_category_rules', 'tenant_isolation_financial_category_rules'],
    ['financial_category_templates', 'tenant_isolation_financial_category_templates'],
    ['financial_centers', 'tenant_isolation_financial_centers'],
    ['marketing_projects', 'tenant_isolation'],
    ['marketing_strategies', 'tenant_isolation'],
    ['marketing_strategy_actions', 'tenant_isolation'],
    ['marketing_strategy_initiatives', 'tenant_isolation'],
    ['marketing_strategy_objectives', 'tenant_isolation'],
    ['marketing_tasks', 'tenant_isolation'],
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [table, policy] of HarmonizeRawTextPolicies20260613000015.SPECS) {
      await queryRunner.query(`DROP POLICY IF EXISTS "${policy}" ON "${table}"`);
      await queryRunner.query(
        `CREATE POLICY "${policy}" ON "${table}" ` +
        `USING (tenant_id = private_get_tenant_id()) ` +
        `WITH CHECK (tenant_id = private_get_tenant_id())`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverte para a forma RAW ::text original (USING + WITH CHECK).
    for (const [table, policy] of HarmonizeRawTextPolicies20260613000015.SPECS) {
      await queryRunner.query(`DROP POLICY IF EXISTS "${policy}" ON "${table}"`);
      await queryRunner.query(
        `CREATE POLICY "${policy}" ON "${table}" ` +
        `USING ((tenant_id)::text = current_setting('app.current_tenant_id', true)) ` +
        `WITH CHECK ((tenant_id)::text = current_setting('app.current_tenant_id', true))`,
      );
    }
  }
}

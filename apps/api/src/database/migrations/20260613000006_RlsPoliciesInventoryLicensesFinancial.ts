import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * PHASE 3B — Sub-batch A (corrective): creates the standard portable policy on the three
 * tables the 3A audit flagged with RLS=ENABLED, FORCE RLS=ENABLED and
 * ZERO policies — i.e. currently in TOTAL DENY for the application role
 * (musicos_app, NOBYPASSRLS).
 *
 *   inventory_items, licenses, financial_rules
 *
 * Mandatory project pattern (portable, NEVER auth.jwt directly):
 *   USING      (tenant_id = private_get_tenant_id())
 *   WITH CHECK (tenant_id = private_get_tenant_id())
 *
 * Idempotent: the policy is only created if it does not exist yet (queries pg_policy).
 * Does NOT change ENABLE/FORCE RLS (already active), does NOT remove existing objects.
 */
export class RlsPoliciesInventoryLicensesFinancial20260613000006 implements MigrationInterface {
  name = 'RlsPoliciesInventoryLicensesFinancial20260613000006';

  private static readonly TABLES = ['inventory_items', 'licenses', 'financial_rules'] as const;
  private static readonly POLICY = 'tenant_isolation';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of RlsPoliciesInventoryLicensesFinancial20260613000006.TABLES) {
      await queryRunner.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_policy
            WHERE polname = '${RlsPoliciesInventoryLicensesFinancial20260613000006.POLICY}'
              AND polrelid = 'public.${table}'::regclass
          ) THEN
            CREATE POLICY "${RlsPoliciesInventoryLicensesFinancial20260613000006.POLICY}"
              ON "${table}"
              USING (tenant_id = private_get_tenant_id())
              WITH CHECK (tenant_id = private_get_tenant_id());
          END IF;
        END $$;
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverts only the policy created by this migration (ENABLE/FORCE preserved).
    for (const table of RlsPoliciesInventoryLicensesFinancial20260613000006.TABLES) {
      await queryRunner.query(
        `DROP POLICY IF EXISTS "${RlsPoliciesInventoryLicensesFinancial20260613000006.POLICY}" ON "${table}"`,
      );
    }
  }
}

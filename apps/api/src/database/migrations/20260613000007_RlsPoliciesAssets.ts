import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * PHASE 3B — Sub-batch B (pilot): enables RLS and creates the standard portable policy
 * on the 5 Assets/Storage tables (3A audit: tenant_id NOT NULL, indexed,
 * no RLS, no policy).
 *
 *   assets, asset_versions, project_assets, task_assets, asset_usage_logs
 *
 * Applies ONLY:  ENABLE ROW LEVEL SECURITY  +  standard policy
 *   USING      (tenant_id = private_get_tenant_id())
 *   WITH CHECK (tenant_id = private_get_tenant_id())
 *
 * Does NOT enable FORCE RLS in this batch (audit decision — validate first).
 * Idempotent: ENABLE RLS is a no-op if already active; the policy is only created if absent.
 */
export class RlsPoliciesAssets20260613000007 implements MigrationInterface {
  name = 'RlsPoliciesAssets20260613000007';

  private static readonly TABLES = [
    'assets', 'asset_versions', 'project_assets', 'task_assets', 'asset_usage_logs',
  ] as const;
  private static readonly POLICY = 'tenant_isolation';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of RlsPoliciesAssets20260613000007.TABLES) {
      await queryRunner.query(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
      await queryRunner.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_policy
            WHERE polname = '${RlsPoliciesAssets20260613000007.POLICY}'
              AND polrelid = 'public.${table}'::regclass
          ) THEN
            CREATE POLICY "${RlsPoliciesAssets20260613000007.POLICY}"
              ON "${table}"
              USING (tenant_id = private_get_tenant_id())
              WITH CHECK (tenant_id = private_get_tenant_id());
          END IF;
        END $$;
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverts policy + disables RLS (original state: no RLS, no policy).
    for (const table of RlsPoliciesAssets20260613000007.TABLES) {
      await queryRunner.query(
        `DROP POLICY IF EXISTS "${RlsPoliciesAssets20260613000007.POLICY}" ON "${table}"`,
      );
      await queryRunner.query(`ALTER TABLE "${table}" DISABLE ROW LEVEL SECURITY`);
    }
  }
}

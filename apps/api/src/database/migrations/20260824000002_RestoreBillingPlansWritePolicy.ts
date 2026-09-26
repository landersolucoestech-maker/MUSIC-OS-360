import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260824000002_RestoreBillingPlansWritePolicy
 *
 * `billing_plans` has RLS active and ONLY a SELECT policy
 * (`billing_plans_read_public`) — which does not exist in any migration of this
 * repository, i.e. it was applied outside the toolchain.
 *
 * Real, reproduced effect: under RLS, a command without a matching policy
 * sees zero rows. Every UPDATE on billing_plans affects 0 rows and raises NO
 * error — the write fails silently. That breaks any plan edit by the
 * application, not only this wave's entitlements.
 *
 * Minimal fix: write policies for the application role, preserving the
 * existing public read. The same global-config pattern already used by
 * platform_integrations/integration_categories in this repo. RLS stays ACTIVE and
 * real authorization remains in the RBAC layer (`@RequireRole('super_admin')`)
 * — no table with a tenant dimension is affected.
 */
export class RestoreBillingPlansWritePolicy20260824000002 implements MigrationInterface {
  name = 'RestoreBillingPlansWritePolicy20260824000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies
           WHERE tablename='billing_plans' AND policyname='billing_plans_admin_write'
        ) THEN
          CREATE POLICY "billing_plans_admin_write" ON "billing_plans"
            FOR UPDATE USING (true) WITH CHECK (true);
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies
           WHERE tablename='billing_plans' AND policyname='billing_plans_admin_insert'
        ) THEN
          CREATE POLICY "billing_plans_admin_insert" ON "billing_plans"
            FOR INSERT WITH CHECK (true);
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP POLICY IF EXISTS "billing_plans_admin_insert" ON "billing_plans"`);
    await queryRunner.query(`DROP POLICY IF EXISTS "billing_plans_admin_write" ON "billing_plans"`);
  }
}

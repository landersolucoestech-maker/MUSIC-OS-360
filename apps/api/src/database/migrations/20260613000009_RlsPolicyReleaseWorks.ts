import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * PHASE 3F — RLS by FK INHERITANCE on release_works (N:N join table without
 * its own tenant_id; composite PK release_id+work_id).
 *
 * Isolation inherited from the TWO parents, already tenantized and protected by RLS:
 *   release_works.release_id → releases.id   (releases.tenant_id NOT NULL, RLS ON)
 *   release_works.work_id    → works.id      (works.tenant_id    NOT NULL, RLS ON)
 *
 * The policy requires BOTH parents to belong to the current tenant (AND), closing the
 * theoretical release.tenant ≠ work.tenant case. Uses the portable pattern
 * private_get_tenant_id() — no current_setting, no auth.uid, no ::text cast.
 *
 * Applies ONLY: ENABLE ROW LEVEL SECURITY + policy. Does NOT enable FORCE RLS.
 * Does not change releases/works nor any other table. Idempotent (ENABLE is a
 * no-op if already active; the policy is only created if absent). Reversible.
 */
export class RlsPolicyReleaseWorks20260613000009 implements MigrationInterface {
  name = 'RlsPolicyReleaseWorks20260613000009';

  private static readonly EXPR =
    `EXISTS (SELECT 1 FROM releases r WHERE r.id = release_works.release_id AND r.tenant_id = private_get_tenant_id())` +
    ` AND ` +
    `EXISTS (SELECT 1 FROM works w WHERE w.id = release_works.work_id AND w.tenant_id = private_get_tenant_id())`;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "release_works" ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policy
          WHERE polname = 'tenant_isolation'
            AND polrelid = 'public.release_works'::regclass
        ) THEN
          CREATE POLICY "tenant_isolation"
            ON "release_works"
            USING (${RlsPolicyReleaseWorks20260613000009.EXPR})
            WITH CHECK (${RlsPolicyReleaseWorks20260613000009.EXPR});
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP POLICY IF EXISTS "tenant_isolation" ON "release_works"`);
    await queryRunner.query(`ALTER TABLE "release_works" DISABLE ROW LEVEL SECURITY`);
  }
}

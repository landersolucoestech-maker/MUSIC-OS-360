import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260610000005_CreateMembershipJobFunctions  (M5 — PHASE 4 Enterprise RBAC)
 *
 * N:N between Membership (org_members) and JobFunction. tenant_id denormalized for RLS.
 * UNIQUE(membership_id, job_function_id) prevents duplicates.
 * CRITICAL RULE: JobFunction grants no permission — this link is organizational only.
 *
 * Idempotent. Reversible via down().
 */
export class CreateMembershipJobFunctions20260610000005 implements MigrationInterface {
  name = 'CreateMembershipJobFunctions20260610000005';

  async up(qr: QueryRunner): Promise<void> {
    await qr.query(`
      CREATE TABLE IF NOT EXISTS "membership_job_functions" (
        "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id"       UUID NOT NULL,
        "membership_id"   UUID NOT NULL,
        "job_function_id" UUID NOT NULL,
        "created_at"      TIMESTAMPTZ NOT NULL DEFAULT now(),
        "created_by"      UUID,
        CONSTRAINT "fk_mjf_tenant"     FOREIGN KEY ("tenant_id")       REFERENCES "tenants"("id")       ON DELETE CASCADE,
        CONSTRAINT "fk_mjf_membership" FOREIGN KEY ("membership_id")   REFERENCES "org_members"("id")   ON DELETE CASCADE,
        CONSTRAINT "fk_mjf_jobfn"      FOREIGN KEY ("job_function_id") REFERENCES "job_functions"("id") ON DELETE RESTRICT,
        CONSTRAINT "uq_mjf_membership_jobfn" UNIQUE ("membership_id", "job_function_id")
      )
    `);
    await qr.query(`CREATE INDEX IF NOT EXISTS "idx_mjf_tenant"  ON "membership_job_functions" ("tenant_id")`);
    await qr.query(`CREATE INDEX IF NOT EXISTS "idx_mjf_jobfn"   ON "membership_job_functions" ("job_function_id")`);
    await qr.query(`CREATE INDEX IF NOT EXISTS "idx_mjf_member"  ON "membership_job_functions" ("membership_id")`);
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP TABLE IF EXISTS "membership_job_functions"`);
  }
}

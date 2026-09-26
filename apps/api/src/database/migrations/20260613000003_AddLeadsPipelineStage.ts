import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * PHASE 2B — Leads reconciliation: adds the `pipeline_stage` column that
 * `LeadEntity`, `LeadsService` (SELECT via the repository) and the CRM automation
 * (`crm-followup.automation.ts`, raw SQL `SELECT ... pipeline_stage ... FROM leads`)
 * already assume, but that NEVER existed in the database. Without the column, every leads
 * `list()`/`findById()` and the automation break at runtime ("column l.pipeline_stage does not exist").
 *
 * A purely ADDITIVE and reversible change: nullable column, no default, no backfill,
 * no change to an existing column, no data loss. Idempotent via IF NOT EXISTS.
 */
export class AddLeadsPipelineStage20260613000003 implements MigrationInterface {
  name = 'AddLeadsPipelineStage20260613000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "pipeline_stage" varchar(100) NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverts only the column added by this migration.
    await queryRunner.query(`ALTER TABLE "leads" DROP COLUMN IF EXISTS "pipeline_stage"`);
  }
}

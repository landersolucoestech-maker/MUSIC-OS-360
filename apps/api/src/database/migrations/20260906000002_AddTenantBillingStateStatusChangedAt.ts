import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260906000002_AddTenantBillingStateStatusChangedAt
 *
 * P0-A remediation (R5): `DunningService`'s notification dedup keyed on
 * `tenant_billing_state.updated_at`, assuming it only changes on a genuine
 * status transition. Confirmed false: `updated_at` is bumped unconditionally
 * by every `ON CONFLICT ... DO UPDATE` writer in `BillingEnforcementService`
 * (even on idempotent re-entry, e.g. a retried Stripe webhook re-applying
 * the same status) and by `BillingService.updateAdminTenant`'s admin-panel
 * path — none of which represent a real transition. Using it as a dedup key
 * lets an unrelated write mint a fresh key and duplicate a notification.
 *
 * `status_changed_at` is additive and metadata-only (no data loss on
 * rollback). Backfilled from `updated_at` for existing rows — the best
 * available approximation, since no per-row transition history exists prior
 * to this migration; correctness is exact for every write going forward,
 * where `BillingEnforcementService.auditStateChange`/`applyManualOverride`
 * set it only when `before.status !== after.status`.
 */
export class AddTenantBillingStateStatusChangedAt20260906000002 implements MigrationInterface {
  name = 'AddTenantBillingStateStatusChangedAt20260906000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tenant_billing_state" ADD COLUMN IF NOT EXISTS "status_changed_at" timestamptz
    `);
    await queryRunner.query(`
      UPDATE "tenant_billing_state" SET "status_changed_at" = "updated_at" WHERE "status_changed_at" IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "tenant_billing_state" ALTER COLUMN "status_changed_at" SET DEFAULT now()
    `);
    await queryRunner.query(`
      ALTER TABLE "tenant_billing_state" ALTER COLUMN "status_changed_at" SET NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tenant_billing_state" DROP COLUMN IF EXISTS "status_changed_at"
    `);
  }
}

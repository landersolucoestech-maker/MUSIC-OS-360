import { MigrationInterface, QueryRunner } from 'typeorm';
import { assertMigrationRoleBypassesRls } from '../migration-guards';
import { assertConfirmed, bounded } from './legacy-column-drop.base';

/**
 * DRAFT, GATED, NOT REGISTERED (LC1). Stage 2 of the invoices.legacy_amount retirement (the "contract" prelude):
 * lets the writers stop populating legacy_amount. Plan: docs/engineering/legacy-column-drop-plan.md.
 * Requires 20260930000022 (service_amount backfilled) and LEGACY_DROP_CONFIRM.
 *
 * up(): gate, RLS guard, lock_timeout; precondition: no row has legacy_amount without service_amount (the
 * backfill must be complete, otherwise rows stored only in the mirror would become unreadable once writers stop);
 * ALTER COLUMN legacy_amount DROP NOT NULL. Reversible and non-destructive.
 * down(): refills NULL legacy_amount from service_amount (0 when both are NULL, the neutral element) and
 * restores NOT NULL.
 */
export class RelaxInvoicesLegacyAmountNotNull20260930000048 implements MigrationInterface {
  name = 'RelaxInvoicesLegacyAmountNotNull20260930000048';

  public async up(queryRunner: QueryRunner): Promise<void> {
    assertConfirmed(this.name);
    await assertMigrationRoleBypassesRls(queryRunner, this.name);
    await queryRunner.query(`SET LOCAL lock_timeout = '15s'`);
    const rows: Array<{ n: number }> = await queryRunner.query(
      `SELECT count(*)::int AS n FROM "invoices" WHERE "legacy_amount" IS NOT NULL AND "service_amount" IS NULL`,
    );
    if ((rows[0]?.n ?? 0) > 0) {
      throw new Error(bounded(`${this.name}: precondition failed: ${rows[0].n} invoice row(s) hold legacy_amount without service_amount; run the 20260930000022 backfill first.`));
    }
    await queryRunner.query(`ALTER TABLE "invoices" ALTER COLUMN "legacy_amount" DROP NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    assertConfirmed(this.name);
    await assertMigrationRoleBypassesRls(queryRunner, this.name);
    await queryRunner.query(`SET LOCAL lock_timeout = '15s'`);
    await queryRunner.query(`UPDATE "invoices" SET "legacy_amount" = COALESCE("service_amount", 0) WHERE "legacy_amount" IS NULL`);
    await queryRunner.query(`ALTER TABLE "invoices" ALTER COLUMN "legacy_amount" SET NOT NULL`);
  }
}

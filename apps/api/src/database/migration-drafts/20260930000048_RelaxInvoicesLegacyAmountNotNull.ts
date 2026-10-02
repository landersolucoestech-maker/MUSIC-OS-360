import { MigrationInterface, QueryRunner } from 'typeorm';
import { assertMigrationRoleBypassesRls } from '../migration-guards';
import { assertConfirmed, bounded, lockTables, presentColumnsOf } from './legacy-column-drop.base';

/**
 * DRAFT, GATED, NOT REGISTERED (LC1). Stage 2 of the invoices.legacy_amount retirement (the "contract" prelude):
 * lets the writers stop populating legacy_amount. Plan: docs/engineering/legacy-column-drop-plan.md.
 * Requires 20260930000022 (service_amount backfilled) and LEGACY_DROP_CONFIRM.
 *
 * up(): gate, RLS guard, lock_timeout, LOCK TABLE invoices IN SHARE ROW EXCLUSIVE MODE (writers wait, so the
 * precondition holds until the ALTER); column presence (same check as runDrop: legacy_amount already gone, i.e. draft 49
 * was applied, is an idempotent no-op instead of an error); precondition: no row has legacy_amount without
 * service_amount (the backfill must be complete, otherwise rows stored only in the mirror would become unreadable once
 * writers stop); ALTER COLUMN legacy_amount DROP NOT NULL. Reversible and non-destructive.
 * down(): same gate/lock. REFUSES when legacy_amount is absent (roll back 49 first) and REFUSES when any row has BOTH
 * legacy_amount and service_amount NULL (typical after the stop-writing release: an invoice created without an amount):
 * restoring NOT NULL would have to invent a 0 that never existed, so the owner reconciles those rows first (counts only
 * in the message). Otherwise it refills NULL legacy_amount from service_amount (never fabricates a value) and restores NOT NULL.
 */
export class RelaxInvoicesLegacyAmountNotNull20260930000048 implements MigrationInterface {
  name = 'RelaxInvoicesLegacyAmountNotNull20260930000048';

  public async up(queryRunner: QueryRunner): Promise<void> {
    assertConfirmed(this.name);
    await assertMigrationRoleBypassesRls(queryRunner, this.name);
    await queryRunner.query(`SET LOCAL lock_timeout = '15s'`);
    await lockTables(queryRunner, ['invoices']);
    if ((await presentColumnsOf(queryRunner, 'invoices', ['legacy_amount'])).length === 0) return; // already retired: idempotent re-run
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
    await lockTables(queryRunner, ['invoices']);
    if ((await presentColumnsOf(queryRunner, 'invoices', ['legacy_amount'])).length === 0) {
      throw new Error(bounded(`${this.name}: refusing down(): invoices.legacy_amount does not exist (roll back 20260930000049 first).`));
    }
    const both: Array<{ n: number }> = await queryRunner.query(
      `SELECT count(*)::int AS n FROM "invoices" WHERE "legacy_amount" IS NULL AND "service_amount" IS NULL`,
    );
    if ((both[0]?.n ?? 0) > 0) {
      throw new Error(bounded(`${this.name}: refusing down(): ${both[0].n} invoice row(s) have neither legacy_amount nor service_amount; restoring NOT NULL would invent a 0. Reconcile those rows (owner decision), then retry.`));
    }
    await queryRunner.query(`UPDATE "invoices" SET "legacy_amount" = "service_amount" WHERE "legacy_amount" IS NULL`);
    await queryRunner.query(`ALTER TABLE "invoices" ALTER COLUMN "legacy_amount" SET NOT NULL`);
  }
}

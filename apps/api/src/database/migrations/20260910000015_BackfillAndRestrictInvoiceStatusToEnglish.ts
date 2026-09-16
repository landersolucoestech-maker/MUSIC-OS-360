import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `invoices.status` (`InvoiceStatus` in packages/types/src/enums.ts) is a
 * plain `varchar(50)` with no CHECK constraint, historically holding the
 * PT-BR canonical enum values `rascunho` / `pendente` / `emitida` / `paga` /
 * `cancelada` / `vencida` / `rejeitada`. This project's deploy model is atomic
 * (schema + app code ship together, no version-skew window), so unlike a
 * phased expand/backfill/contract/restrict rollout across separate deploys,
 * this single migration folds backfill + restrict together: there is no live
 * window where old app code (reading/writing PT-BR values) and this
 * migration's new CHECK constraint (English-only) coexist. The
 * `packages/types` enum values are switched to English in the same change set
 * that registers this migration, so by the time this runs, no code path still
 * writes the PT-BR enum values.
 *
 * Steps:
 *   1. Idempotently backfill existing rows from PT-BR to EN values (logs
 *      affected row count per value; matches only rows still holding an old
 *      value, so safe to re-run).
 *   2. Audit for any remaining unexpected value before adding the constraint,
 *      following the same pattern as
 *      `20260910000003_BackfillAndRestrictArtistGoalStatusToEnglish.ts`.
 *   3. Add `chk_invoices_status` CHECK constraint restricting the column to
 *      the English enum values.
 */
export class BackfillAndRestrictInvoiceStatusToEnglish20260910000015
  implements MigrationInterface
{
  name = 'BackfillAndRestrictInvoiceStatusToEnglish20260910000015';

  private readonly ptToEn: Array<[string, string]> = [
    ['rascunho', 'draft'],
    ['pendente', 'pending'],
    ['emitida', 'issued'],
    ['paga', 'paid'],
    ['cancelada', 'cancelled'],
    ['vencida', 'overdue'],
    ['rejeitada', 'rejected'],
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [pt, en] of this.ptToEn) {
      const [{ affected }] = await queryRunner.query(
        `WITH updated AS (
           UPDATE invoices SET status = $2, updated_at = now()
           WHERE status = $1
           RETURNING id
         )
         SELECT count(*)::int AS affected FROM updated`,
        [pt, en],
      );
      // eslint-disable-next-line no-console
      console.log(
        `[BackfillAndRestrictInvoiceStatusToEnglish] invoices.status '${pt}' -> '${en}': ${affected} row(s)`,
      );
    }

    const invalidRows: Array<{ status: string }> = await queryRunner.query(
      `SELECT DISTINCT status
       FROM "invoices"
       WHERE status NOT IN ('draft', 'pending', 'issued', 'paid', 'cancelled', 'overdue', 'rejected')`,
    );

    if (invalidRows.length > 0) {
      const invalidValues = invalidRows.map((row) => row.status).join(', ');
      throw new Error(
        `BackfillAndRestrictInvoiceStatusToEnglish20260910000015: cannot add CHECK constraint, ` +
          `"invoices" contains rows with unexpected status values after backfill: [${invalidValues}]. ` +
          `Fix or migrate this data before re-running this migration.`,
      );
    }

    // Column DEFAULT still held the old PT-BR value ('pendente') -- any INSERT
    // relying on it (no explicit status) would violate the CHECK constraint
    // added below.
    await queryRunner.query(`ALTER TABLE "invoices" ALTER COLUMN "status" SET DEFAULT 'pending'`);

    await queryRunner.query(`
      ALTER TABLE "invoices"
      ADD CONSTRAINT "chk_invoices_status"
      CHECK ("status" IN ('draft', 'pending', 'issued', 'paid', 'cancelled', 'overdue', 'rejected'))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "invoices"
      DROP CONSTRAINT IF EXISTS "chk_invoices_status"
    `);
    await queryRunner.query(`ALTER TABLE "invoices" ALTER COLUMN "status" SET DEFAULT 'pendente'`);

    for (const [pt, en] of this.ptToEn) {
      await queryRunner.query(
        `UPDATE invoices SET status = $1, updated_at = now() WHERE status = $2`,
        [pt, en],
      );
    }
  }
}

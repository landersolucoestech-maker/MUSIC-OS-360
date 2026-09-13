import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `transactions.status` (`TransactionStatus` in packages/types/src/enums.ts) is
 * a plain `varchar(50)` with no CHECK constraint, historically holding the
 * PT-BR canonical enum values `pendente` / `concluido` / `confirmado` /
 * `pago` / `cancelado` / `agendado`. `pago` is a third pre-existing synonym
 * for "settled" alongside `concluido`/`confirmado` (see analytics.service.ts
 * and transactions.service.ts PAID_STATUSES, both of which already treat all
 * three as equivalent) — translated 1:1 to `paid` rather than merged into an
 * existing value, since consolidating three historically-distinct values is
 * a data-model decision, not a naming translation.
 *
 * This project's deploy model is atomic (schema +
 * app code ship together, no version-skew window), so unlike a phased
 * expand/backfill/contract/restrict rollout across separate deploys, this
 * single migration folds backfill + restrict together: there is no live
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
 *   3. Add `chk_transactions_status` CHECK constraint restricting the column
 *      to the English enum values.
 */
export class BackfillAndRestrictTransactionStatusToEnglish20260910000014
  implements MigrationInterface
{
  name = 'BackfillAndRestrictTransactionStatusToEnglish20260910000014';

  private readonly ptToEn: Array<[string, string]> = [
    ['pendente', 'pending'],
    ['concluido', 'completed'],
    ['confirmado', 'confirmed'],
    ['pago', 'paid'],
    ['cancelado', 'cancelled'],
    ['agendado', 'scheduled'],
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [pt, en] of this.ptToEn) {
      const [{ affected }] = await queryRunner.query(
        `WITH updated AS (
           UPDATE transactions SET status = $2, updated_at = now()
           WHERE status = $1
           RETURNING id
         )
         SELECT count(*)::int AS affected FROM updated`,
        [pt, en],
      );
      // eslint-disable-next-line no-console
      console.log(
        `[BackfillAndRestrictTransactionStatusToEnglish] transactions.status '${pt}' -> '${en}': ${affected} row(s)`,
      );
    }

    const invalidRows: Array<{ status: string }> = await queryRunner.query(
      `SELECT DISTINCT status
       FROM "transactions"
       WHERE status NOT IN ('pending', 'completed', 'confirmed', 'paid', 'cancelled', 'scheduled')`,
    );

    if (invalidRows.length > 0) {
      const invalidValues = invalidRows.map((row) => row.status).join(', ');
      throw new Error(
        `BackfillAndRestrictTransactionStatusToEnglish20260910000014: cannot add CHECK constraint, ` +
          `"transactions" contains rows with unexpected status values after backfill: [${invalidValues}]. ` +
          `Fix or migrate this data before re-running this migration.`,
      );
    }

    await queryRunner.query(`
      ALTER TABLE "transactions"
      ADD CONSTRAINT "chk_transactions_status"
      CHECK ("status" IN ('pending', 'completed', 'confirmed', 'paid', 'cancelled', 'scheduled'))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "transactions"
      DROP CONSTRAINT IF EXISTS "chk_transactions_status"
    `);

    for (const [pt, en] of this.ptToEn) {
      await queryRunner.query(
        `UPDATE transactions SET status = $1, updated_at = now() WHERE status = $2`,
        [pt, en],
      );
    }
  }
}

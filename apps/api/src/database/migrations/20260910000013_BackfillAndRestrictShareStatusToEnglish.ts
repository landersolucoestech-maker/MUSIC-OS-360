import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `shares.status` (`ShareStatus` in packages/types/src/enums.ts) is a plain
 * `varchar(50)` with no CHECK constraint, created with `DEFAULT 'ativo'`
 * (migration `20260719000014_RebuildSharesInCanonicalFormOrder`). This
 * project's deploy model is atomic (schema + app code ship together, no
 * version-skew window), so — same as
 * `20260910000003_BackfillAndRestrictArtistGoalStatusToEnglish` — this single
 * migration folds backfill + restrict together.
 *
 * Steps:
 *   1. Idempotently backfill the known legacy PT-BR values to English
 *      (logs affected row count per value; matches only rows still holding
 *      an old value, so safe to re-run).
 *   2. Audit for any remaining unexpected value before adding the
 *      constraint, following the same pattern as
 *      `20260910000002_AddArtistPlatformProfilesSyncStatusCheck.ts`.
 *   3. Add `chk_shares_status` CHECK constraint restricting the column to
 *      the English enum values.
 *
 * NOTE: `shares.status` is shared by two independent write paths on the same
 * physical column: the `ativo`/`inativo`/`pendente`/`liquidado` lifecycle
 * concept this migration targets, and a separate financial-negotiation
 * status vocabulary written by `SharePendenteFormModal.tsx` /
 * `GestaoShares.tsx` (`pendente`/`enviado`/`aceito`/`recebido`/`recusado`/
 * `erro`/`cancelado`/`parcial`). Only `pendente` overlaps between the two.
 * If any row holds one of the other negotiation-status values, the audit
 * step below throws instead of silently adding a constraint that would
 * reject that live write path — that conflict is a product/schema decision
 * out of scope for this change and must be resolved (e.g. splitting the
 * concepts into two columns, or widening the enum) before this migration
 * can succeed against real data.
 */
export class BackfillAndRestrictShareStatusToEnglish20260910000013
  implements MigrationInterface
{
  name = 'BackfillAndRestrictShareStatusToEnglish20260910000013';

  private readonly ptToEn: Array<[string, string]> = [
    ['ativo', 'active'],
    ['inativo', 'inactive'],
    ['pendente', 'pending'],
    ['liquidado', 'settled'],
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [pt, en] of this.ptToEn) {
      const [{ affected }] = await queryRunner.query(
        `WITH updated AS (
           UPDATE shares SET status = $2, updated_at = now()
           WHERE status = $1
           RETURNING id
         )
         SELECT count(*)::int AS affected FROM updated`,
        [pt, en],
      );
      // eslint-disable-next-line no-console
      console.log(
        `[BackfillAndRestrictShareStatusToEnglish] shares.status '${pt}' -> '${en}': ${affected} row(s)`,
      );
    }

    const invalidRows: Array<{ status: string }> = await queryRunner.query(
      `SELECT DISTINCT status
       FROM "shares"
       WHERE status NOT IN ('active', 'inactive', 'pending', 'settled')`,
    );

    if (invalidRows.length > 0) {
      const invalidValues = invalidRows.map((row) => row.status).join(', ');
      throw new Error(
        `BackfillAndRestrictShareStatusToEnglish20260910000013: cannot add CHECK constraint, ` +
          `"shares" contains rows with unexpected status values after backfill: [${invalidValues}]. ` +
          `Fix or migrate this data before re-running this migration.`,
      );
    }

    await queryRunner.query(`
      ALTER TABLE "shares"
      ADD CONSTRAINT "chk_shares_status"
      CHECK ("status" IN ('active', 'inactive', 'pending', 'settled'))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "shares"
      DROP CONSTRAINT IF EXISTS "chk_shares_status"
    `);

    for (const [pt, en] of this.ptToEn) {
      await queryRunner.query(
        `UPDATE shares SET status = $1, updated_at = now() WHERE status = $2`,
        [pt, en],
      );
    }
  }
}

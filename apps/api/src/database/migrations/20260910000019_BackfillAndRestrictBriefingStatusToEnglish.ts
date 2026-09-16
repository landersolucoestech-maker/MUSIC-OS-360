import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `briefings.status` (`BriefingStatus` in packages/types/src/enums.ts) is a
 * plain `varchar(50)` with no CHECK constraint, currently holding the PT-BR
 * values `rascunho` / `em_andamento` / `revisao` / `aprovado` / `concluido` /
 * `cancelado`. This project's deploy model is atomic (schema + app code ship
 * together, no version-skew window), so unlike a phased
 * expand/backfill/contract/restrict rollout across separate deploys, this
 * single migration folds backfill + restrict together: there is no live
 * window where old app code (reading/writing PT-BR values) and this
 * migration's new CHECK constraint (English-only) coexist. The
 * `packages/types` enum values are switched to English in the same change
 * set that registers this migration, so by the time this runs, no code path
 * still writes the PT-BR values.
 *
 * Steps:
 *   1. Idempotently backfill existing rows from PT-BR to EN values (logs
 *      affected row count per value; matches only rows still holding an old
 *      value, so safe to re-run).
 *   2. Audit for any remaining unexpected value before adding the constraint,
 *      following the same pattern as
 *      `20260910000003_BackfillAndRestrictArtistGoalStatusToEnglish.ts`.
 *   3. Add `chk_briefings_status` CHECK constraint restricting the column to
 *      the English enum values.
 */
export class BackfillAndRestrictBriefingStatusToEnglish20260910000019
  implements MigrationInterface
{
  name = 'BackfillAndRestrictBriefingStatusToEnglish20260910000019';

  private readonly ptToEn: Array<[string, string]> = [
    ['rascunho', 'draft'],
    ['em_andamento', 'in_progress'],
    ['revisao', 'review'],
    ['aprovado', 'approved'],
    ['concluido', 'completed'],
    ['cancelado', 'cancelled'],
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [pt, en] of this.ptToEn) {
      const [{ affected }] = await queryRunner.query(
        `WITH updated AS (
           UPDATE briefings SET status = $2, updated_at = now()
           WHERE status = $1
           RETURNING id
         )
         SELECT count(*)::int AS affected FROM updated`,
        [pt, en],
      );
      console.log(
        `[BackfillAndRestrictBriefingStatusToEnglish] briefings.status '${pt}' -> '${en}': ${affected} row(s)`,
      );
    }

    const invalidRows: Array<{ status: string }> = await queryRunner.query(
      `SELECT DISTINCT status
       FROM "briefings"
       WHERE status NOT IN ('draft', 'in_progress', 'review', 'approved', 'completed', 'cancelled')`,
    );

    if (invalidRows.length > 0) {
      const invalidValues = invalidRows.map((row) => row.status).join(', ');
      throw new Error(
        `BackfillAndRestrictBriefingStatusToEnglish20260910000019: cannot add CHECK constraint, ` +
          `"briefings" contains rows with unexpected status values after backfill: [${invalidValues}]. ` +
          `Fix or migrate this data before re-running this migration.`,
      );
    }

    // Column DEFAULT still held the old PT-BR value ('rascunho') -- any INSERT
    // relying on it (no explicit status) would violate the CHECK constraint
    // added below.
    await queryRunner.query(`ALTER TABLE "briefings" ALTER COLUMN "status" SET DEFAULT 'draft'`);

    await queryRunner.query(`
      ALTER TABLE "briefings"
      ADD CONSTRAINT "chk_briefings_status"
      CHECK ("status" IN ('draft', 'in_progress', 'review', 'approved', 'completed', 'cancelled'))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "briefings"
      DROP CONSTRAINT IF EXISTS "chk_briefings_status"
    `);
    await queryRunner.query(`ALTER TABLE "briefings" ALTER COLUMN "status" SET DEFAULT 'rascunho'`);

    for (const [pt, en] of this.ptToEn) {
      await queryRunner.query(
        `UPDATE briefings SET status = $1, updated_at = now() WHERE status = $2`,
        [pt, en],
      );
    }
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `artist_goals.status` (`ArtistGoalStatus` in packages/types/src/enums.ts) is a
 * plain `varchar(50)` with no CHECK constraint, currently holding the PT-BR
 * values `em_andamento` / `concluido` / `cancelado` / `expirado`. This project's
 * deploy model is atomic (schema + app code ship together, no version-skew
 * window), so unlike a phased expand/backfill/contract/restrict rollout across
 * separate deploys, this single migration folds backfill + restrict together:
 * there is no live window where old app code (reading/writing PT-BR values)
 * and this migration's new CHECK constraint (English-only) coexist. The
 * `packages/types` enum values are switched to English in the same change set
 * that registers this migration, so by the time this runs, no code path still
 * writes the PT-BR values.
 *
 * Sourced from the read-only audit proposal
 * `20260910900001_PROPOSAL_BackfillArtistGoalStatusToEnglish.ts` (kept in the
 * migrations directory as historical proposal record; superseded by this file
 * as the actual, registered migration — not deleted, not registered itself).
 *
 * Steps:
 *   1. Idempotently backfill existing rows from PT-BR to EN values (logs
 *      affected row count per value; matches only rows still holding an old
 *      value, so safe to re-run).
 *   2. Audit for any remaining unexpected value before adding the constraint,
 *      following the same pattern as
 *      `20260910000002_AddArtistPlatformProfilesSyncStatusCheck.ts`.
 *   3. Add `chk_artist_goals_status` CHECK constraint restricting the column
 *      to the English enum values.
 */
export class BackfillAndRestrictArtistGoalStatusToEnglish20260910000003
  implements MigrationInterface
{
  name = 'BackfillAndRestrictArtistGoalStatusToEnglish20260910000003';

  private readonly ptToEn: Array<[string, string]> = [
    ['em_andamento', 'in_progress'],
    ['concluido', 'completed'],
    ['cancelado', 'cancelled'],
    ['expirado', 'expired'],
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [pt, en] of this.ptToEn) {
      const [{ affected }] = await queryRunner.query(
        `WITH updated AS (
           UPDATE artist_goals SET status = $2, updated_at = now()
           WHERE status = $1
           RETURNING id
         )
         SELECT count(*)::int AS affected FROM updated`,
        [pt, en],
      );
      // eslint-disable-next-line no-console
      console.log(
        `[BackfillAndRestrictArtistGoalStatusToEnglish] artist_goals.status '${pt}' -> '${en}': ${affected} row(s)`,
      );
    }

    const invalidRows: Array<{ status: string }> = await queryRunner.query(
      `SELECT DISTINCT status
       FROM "artist_goals"
       WHERE status NOT IN ('in_progress', 'completed', 'cancelled', 'expired')`,
    );

    if (invalidRows.length > 0) {
      const invalidValues = invalidRows.map((row) => row.status).join(', ');
      throw new Error(
        `BackfillAndRestrictArtistGoalStatusToEnglish20260910000003: cannot add CHECK constraint, ` +
          `"artist_goals" contains rows with unexpected status values after backfill: [${invalidValues}]. ` +
          `Fix or migrate this data before re-running this migration.`,
      );
    }

    await queryRunner.query(`
      ALTER TABLE "artist_goals"
      ADD CONSTRAINT "chk_artist_goals_status"
      CHECK ("status" IN ('in_progress', 'completed', 'cancelled', 'expired'))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "artist_goals"
      DROP CONSTRAINT IF EXISTS "chk_artist_goals_status"
    `);

    for (const [pt, en] of this.ptToEn) {
      await queryRunner.query(
        `UPDATE artist_goals SET status = $1, updated_at = now() WHERE status = $2`,
        [pt, en],
      );
    }
  }
}

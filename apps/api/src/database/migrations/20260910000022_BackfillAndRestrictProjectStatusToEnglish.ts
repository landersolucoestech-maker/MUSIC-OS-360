import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `projects.status` (`ProjectStatus` in packages/types/src/enums.ts) is a
 * plain `varchar(50)` with no CHECK constraint, currently holding the PT-BR
 * values `planejamento` / `em_andamento` / `revisao` / `concluido` /
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
 *   3. Add `chk_projects_status` CHECK constraint restricting the column to
 *      the English enum values.
 */
export class BackfillAndRestrictProjectStatusToEnglish20260910000022
  implements MigrationInterface
{
  name = 'BackfillAndRestrictProjectStatusToEnglish20260910000022';

  private readonly ptToEn: Array<[string, string]> = [
    ['planejamento', 'planning'],
    ['em_andamento', 'in_progress'],
    ['revisao', 'review'],
    ['concluido', 'completed'],
    ['cancelado', 'cancelled'],
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [pt, en] of this.ptToEn) {
      const [{ affected }] = await queryRunner.query(
        `WITH updated AS (
           UPDATE projects SET status = $2, updated_at = now()
           WHERE status = $1
           RETURNING id
         )
         SELECT count(*)::int AS affected FROM updated`,
        [pt, en],
      );
      // eslint-disable-next-line no-console
      console.log(
        `[BackfillAndRestrictProjectStatusToEnglish] projects.status '${pt}' -> '${en}': ${affected} row(s)`,
      );
    }

    const invalidRows: Array<{ status: string }> = await queryRunner.query(
      `SELECT DISTINCT status
       FROM "projects"
       WHERE status NOT IN ('planning', 'in_progress', 'review', 'completed', 'cancelled')`,
    );

    if (invalidRows.length > 0) {
      const invalidValues = invalidRows.map((row) => row.status).join(', ');
      throw new Error(
        `BackfillAndRestrictProjectStatusToEnglish20260910000022: cannot add CHECK constraint, ` +
          `"projects" contains rows with unexpected status values after backfill: [${invalidValues}]. ` +
          `Fix or migrate this data before re-running this migration.`,
      );
    }

    // Column DEFAULT still held the old PT-BR value ('planejamento') -- any INSERT
    // relying on it (no explicit status) would violate the CHECK constraint
    // added below.
    await queryRunner.query(`ALTER TABLE "projects" ALTER COLUMN "status" SET DEFAULT 'planning'`);

    await queryRunner.query(`
      ALTER TABLE "projects"
      ADD CONSTRAINT "chk_projects_status"
      CHECK ("status" IN ('planning', 'in_progress', 'review', 'completed', 'cancelled'))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "projects"
      DROP CONSTRAINT IF EXISTS "chk_projects_status"
    `);
    await queryRunner.query(`ALTER TABLE "projects" ALTER COLUMN "status" SET DEFAULT 'planejamento'`);

    for (const [pt, en] of this.ptToEn) {
      await queryRunner.query(
        `UPDATE projects SET status = $1, updated_at = now() WHERE status = $2`,
        [pt, en],
      );
    }
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `content_detections.status` (`ContentDetectionStatus` in
 * packages/types/src/enums.ts) is a plain `varchar(50)` with no CHECK
 * constraint, currently holding the PT-BR values `pendente` / `em_andamento` /
 * `concluido` / `rejeitado` / `arquivado`. Same atomic deploy model and
 * single-migration backfill+restrict pattern as
 * `20260910000003_BackfillAndRestrictArtistGoalStatusToEnglish.ts` — see that
 * file for the full rationale.
 */
export class BackfillAndRestrictContentDetectionStatusToEnglish20260910000021
  implements MigrationInterface
{
  name = 'BackfillAndRestrictContentDetectionStatusToEnglish20260910000021';

  private readonly ptToEn: Array<[string, string]> = [
    ['pendente', 'pending'],
    ['em_andamento', 'in_progress'],
    ['concluido', 'completed'],
    ['rejeitado', 'rejected'],
    ['arquivado', 'archived'],
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [pt, en] of this.ptToEn) {
      const [{ affected }] = await queryRunner.query(
        `WITH updated AS (
           UPDATE content_detections SET status = $2, updated_at = now()
           WHERE status = $1
           RETURNING id
         )
         SELECT count(*)::int AS affected FROM updated`,
        [pt, en],
      );
      // eslint-disable-next-line no-console
      console.log(
        `[BackfillAndRestrictContentDetectionStatusToEnglish] content_detections.status '${pt}' -> '${en}': ${affected} row(s)`,
      );
    }

    const invalidRows: Array<{ status: string }> = await queryRunner.query(
      `SELECT DISTINCT status
       FROM "content_detections"
       WHERE status NOT IN ('pending', 'in_progress', 'completed', 'rejected', 'archived')`,
    );

    if (invalidRows.length > 0) {
      const invalidValues = invalidRows.map((row) => row.status).join(', ');
      throw new Error(
        `BackfillAndRestrictContentDetectionStatusToEnglish20260910000021: cannot add CHECK constraint, ` +
          `"content_detections" contains rows with unexpected status values after backfill: [${invalidValues}]. ` +
          `Fix or migrate this data before re-running this migration.`,
      );
    }

    await queryRunner.query(`
      ALTER TABLE "content_detections"
      ADD CONSTRAINT "chk_content_detections_status"
      CHECK ("status" IN ('pending', 'in_progress', 'completed', 'rejected', 'archived'))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "content_detections"
      DROP CONSTRAINT IF EXISTS "chk_content_detections_status"
    `);

    for (const [pt, en] of this.ptToEn) {
      await queryRunner.query(
        `UPDATE content_detections SET status = $1, updated_at = now() WHERE status = $2`,
        [pt, en],
      );
    }
  }
}

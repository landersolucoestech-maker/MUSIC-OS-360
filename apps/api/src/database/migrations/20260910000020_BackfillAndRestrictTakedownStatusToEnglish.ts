import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `takedowns.status` (`TakedownStatus` in packages/types/src/enums.ts) is a
 * plain `varchar(50)` with no CHECK constraint, currently holding the PT-BR
 * values `pendente` / `enviado` / `processando` / `em_andamento` / `concluido` /
 * `rejeitado` / `falhou`. Same atomic deploy model and single-migration
 * backfill+restrict pattern as
 * `20260910000003_BackfillAndRestrictArtistGoalStatusToEnglish.ts` — see that
 * file for the full rationale.
 */
export class BackfillAndRestrictTakedownStatusToEnglish20260910000020
  implements MigrationInterface
{
  name = 'BackfillAndRestrictTakedownStatusToEnglish20260910000020';

  private readonly ptToEn: Array<[string, string]> = [
    ['pendente', 'pending'],
    ['enviado', 'sent'],
    ['processando', 'processing'],
    ['em_andamento', 'in_progress'],
    ['concluido', 'completed'],
    ['rejeitado', 'rejected'],
    ['falhou', 'failed'],
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [pt, en] of this.ptToEn) {
      const [{ affected }] = await queryRunner.query(
        `WITH updated AS (
           UPDATE takedowns SET status = $2, updated_at = now()
           WHERE status = $1
           RETURNING id
         )
         SELECT count(*)::int AS affected FROM updated`,
        [pt, en],
      );
      // eslint-disable-next-line no-console
      console.log(
        `[BackfillAndRestrictTakedownStatusToEnglish] takedowns.status '${pt}' -> '${en}': ${affected} row(s)`,
      );
    }

    const invalidRows: Array<{ status: string }> = await queryRunner.query(
      `SELECT DISTINCT status
       FROM "takedowns"
       WHERE status NOT IN ('pending', 'sent', 'processing', 'in_progress', 'completed', 'rejected', 'failed')`,
    );

    if (invalidRows.length > 0) {
      const invalidValues = invalidRows.map((row) => row.status).join(', ');
      throw new Error(
        `BackfillAndRestrictTakedownStatusToEnglish20260910000020: cannot add CHECK constraint, ` +
          `"takedowns" contains rows with unexpected status values after backfill: [${invalidValues}]. ` +
          `Fix or migrate this data before re-running this migration.`,
      );
    }

    await queryRunner.query(`
      ALTER TABLE "takedowns"
      ADD CONSTRAINT "chk_takedowns_status"
      CHECK ("status" IN ('pending', 'sent', 'processing', 'in_progress', 'completed', 'rejected', 'failed'))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "takedowns"
      DROP CONSTRAINT IF EXISTS "chk_takedowns_status"
    `);

    for (const [pt, en] of this.ptToEn) {
      await queryRunner.query(
        `UPDATE takedowns SET status = $1, updated_at = now() WHERE status = $2`,
        [pt, en],
      );
    }
  }
}

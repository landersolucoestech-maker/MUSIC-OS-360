import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `campaigns.status` (`CampaignStatus` in packages/types/src/enums.ts) is a
 * plain `varchar(50)` with no CHECK constraint, currently holding the PT-BR
 * values `rascunho` / `planejamento` / `ativa` / `pausada` / `concluida` /
 * `cancelada`. This project's deploy model is atomic (schema + app code ship
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
 *   3. Add `chk_campaigns_status` CHECK constraint restricting the column to
 *      the English enum values.
 */
export class BackfillAndRestrictCampaignStatusToEnglish20260910000018
  implements MigrationInterface
{
  name = 'BackfillAndRestrictCampaignStatusToEnglish20260910000018';

  private readonly ptToEn: Array<[string, string]> = [
    ['rascunho', 'draft'],
    ['planejamento', 'planning'],
    ['ativa', 'active'],
    ['pausada', 'paused'],
    ['concluida', 'completed'],
    ['cancelada', 'cancelled'],
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [pt, en] of this.ptToEn) {
      const [{ affected }] = await queryRunner.query(
        `WITH updated AS (
           UPDATE campaigns SET status = $2, updated_at = now()
           WHERE status = $1
           RETURNING id
         )
         SELECT count(*)::int AS affected FROM updated`,
        [pt, en],
      );
      console.log(
        `[BackfillAndRestrictCampaignStatusToEnglish] campaigns.status '${pt}' -> '${en}': ${affected} row(s)`,
      );
    }

    const invalidRows: Array<{ status: string }> = await queryRunner.query(
      `SELECT DISTINCT status
       FROM "campaigns"
       WHERE status NOT IN ('draft', 'planning', 'active', 'paused', 'completed', 'cancelled')`,
    );

    if (invalidRows.length > 0) {
      const invalidValues = invalidRows.map((row) => row.status).join(', ');
      throw new Error(
        `BackfillAndRestrictCampaignStatusToEnglish20260910000018: cannot add CHECK constraint, ` +
          `"campaigns" contains rows with unexpected status values after backfill: [${invalidValues}]. ` +
          `Fix or migrate this data before re-running this migration.`,
      );
    }

    await queryRunner.query(`
      ALTER TABLE "campaigns"
      ADD CONSTRAINT "chk_campaigns_status"
      CHECK ("status" IN ('draft', 'planning', 'active', 'paused', 'completed', 'cancelled'))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "campaigns"
      DROP CONSTRAINT IF EXISTS "chk_campaigns_status"
    `);

    for (const [pt, en] of this.ptToEn) {
      await queryRunner.query(
        `UPDATE campaigns SET status = $1, updated_at = now() WHERE status = $2`,
        [pt, en],
      );
    }
  }
}

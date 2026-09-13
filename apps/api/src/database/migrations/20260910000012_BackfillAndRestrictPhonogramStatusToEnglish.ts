import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `phonograms.status` (`PhonogramStatus` in packages/types/src/enums.ts) is a
 * plain `varchar(50)` with no CHECK constraint, currently holding the PT-BR
 * values `pendente` / `analise` / `em_analise` / `registrado` / `ativo` /
 * `inativo` / `rejeitado` / `arquivado`. This project's deploy model is
 * atomic (schema + app code ship together, no version-skew window), so
 * unlike a phased expand/backfill/contract/restrict rollout across separate
 * deploys, this single migration folds backfill + restrict together: there
 * is no live window where old app code (reading/writing PT-BR values) and
 * this migration's new CHECK constraint (English-only) coexist. The
 * `packages/types` enum values are switched to English in the same change
 * set that registers this migration, so by the time this runs, no code path
 * still writes the PT-BR values.
 *
 * Follows the same pattern as
 * `20260910000003_BackfillAndRestrictArtistGoalStatusToEnglish.ts` and
 * `20260910000011_BackfillAndRestrictWorkStatusToEnglish.ts`.
 *
 * Steps:
 *   1. Idempotently backfill existing rows from PT-BR to EN values (logs
 *      affected row count per value; matches only rows still holding an old
 *      value, so safe to re-run).
 *   2. Audit for any remaining unexpected value before adding the constraint.
 *   3. Add `chk_phonograms_status` CHECK constraint restricting the column
 *      to the English enum values.
 */
export class BackfillAndRestrictPhonogramStatusToEnglish20260910000012
  implements MigrationInterface
{
  name = 'BackfillAndRestrictPhonogramStatusToEnglish20260910000012';

  private readonly ptToEn: Array<[string, string]> = [
    ['pendente', 'pending'],
    ['analise', 'under_review'],
    ['em_analise', 'in_review'],
    ['registrado', 'registered'],
    ['ativo', 'active'],
    ['inativo', 'inactive'],
    ['rejeitado', 'rejected'],
    ['arquivado', 'archived'],
  ];

  private readonly enValues = [
    'pending',
    'under_review',
    'in_review',
    'registered',
    'active',
    'inactive',
    'rejected',
    'archived',
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [pt, en] of this.ptToEn) {
      const [{ affected }] = await queryRunner.query(
        `WITH updated AS (
           UPDATE phonograms SET status = $2, updated_at = now()
           WHERE status = $1
           RETURNING id
         )
         SELECT count(*)::int AS affected FROM updated`,
        [pt, en],
      );
      // eslint-disable-next-line no-console
      console.log(
        `[BackfillAndRestrictPhonogramStatusToEnglish] phonograms.status '${pt}' -> '${en}': ${affected} row(s)`,
      );
    }

    const invalidRows: Array<{ status: string }> = await queryRunner.query(
      `SELECT DISTINCT status
       FROM "phonograms"
       WHERE status NOT IN (${this.enValues.map((_, i) => `$${i + 1}`).join(', ')})`,
      this.enValues,
    );

    if (invalidRows.length > 0) {
      const invalidValues = invalidRows.map((row) => row.status).join(', ');
      throw new Error(
        `BackfillAndRestrictPhonogramStatusToEnglish20260910000012: cannot add CHECK constraint, ` +
          `"phonograms" contains rows with unexpected status values after backfill: [${invalidValues}]. ` +
          `Fix or migrate this data before re-running this migration.`,
      );
    }

    await queryRunner.query(`
      ALTER TABLE "phonograms"
      ADD CONSTRAINT "chk_phonograms_status"
      CHECK ("status" IN (${this.enValues.map((v) => `'${v}'`).join(', ')}))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "phonograms"
      DROP CONSTRAINT IF EXISTS "chk_phonograms_status"
    `);

    for (const [pt, en] of this.ptToEn) {
      await queryRunner.query(
        `UPDATE phonograms SET status = $1, updated_at = now() WHERE status = $2`,
        [pt, en],
      );
    }
  }
}

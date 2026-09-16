import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `events.status` (`EventStatus` in packages/types/src/enums.ts) is a plain
 * `varchar(50)` with no CHECK constraint, currently holding the PT-BR values
 * `planejado` / `agendado` / `confirmado` / `realizado` / `concluido` /
 * `cancelado` / `adiado`. This project's deploy model is atomic (schema + app
 * code ship together, no version-skew window), so this single migration
 * folds backfill + restrict together — same pattern as
 * `20260910000003_BackfillAndRestrictArtistGoalStatusToEnglish.ts`.
 *
 * Steps:
 *   1. Idempotently backfill existing rows from PT-BR to EN values (logs
 *      affected row count per value; matches only rows still holding an old
 *      value, so safe to re-run).
 *   2. Audit for any remaining unexpected value before adding the constraint.
 *   3. Add `chk_events_status` CHECK constraint restricting the column to the
 *      English enum values.
 */
export class BackfillAndRestrictEventStatusToEnglish20260910000023
  implements MigrationInterface
{
  name = 'BackfillAndRestrictEventStatusToEnglish20260910000023';

  private readonly ptToEn: Array<[string, string]> = [
    ['planejado', 'planned'],
    ['agendado', 'scheduled'],
    ['confirmado', 'confirmed'],
    ['realizado', 'held'],
    ['concluido', 'completed'],
    ['cancelado', 'cancelled'],
    ['adiado', 'postponed'],
  ];

  private readonly enValues = [
    'planned',
    'scheduled',
    'confirmed',
    'held',
    'completed',
    'cancelled',
    'postponed',
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [pt, en] of this.ptToEn) {
      const [{ affected }] = await queryRunner.query(
        `WITH updated AS (
           UPDATE events SET status = $2, updated_at = now()
           WHERE status = $1
           RETURNING id
         )
         SELECT count(*)::int AS affected FROM updated`,
        [pt, en],
      );
      // eslint-disable-next-line no-console
      console.log(
        `[BackfillAndRestrictEventStatusToEnglish] events.status '${pt}' -> '${en}': ${affected} row(s)`,
      );
    }

    const invalidRows: Array<{ status: string }> = await queryRunner.query(
      `SELECT DISTINCT status
       FROM "events"
       WHERE status NOT IN (${this.enValues.map((_, i) => `$${i + 1}`).join(', ')})`,
      this.enValues,
    );

    if (invalidRows.length > 0) {
      const invalidValues = invalidRows.map((row) => row.status).join(', ');
      throw new Error(
        `BackfillAndRestrictEventStatusToEnglish20260910000023: cannot add CHECK constraint, ` +
          `"events" contains rows with unexpected status values after backfill: [${invalidValues}]. ` +
          `Fix or migrate this data before re-running this migration.`,
      );
    }

    // Column DEFAULT still held the old PT-BR value ('agendado') -- any INSERT
    // relying on it (no explicit status) would violate the CHECK constraint
    // added below.
    await queryRunner.query(`ALTER TABLE "events" ALTER COLUMN "status" SET DEFAULT 'scheduled'`);

    await queryRunner.query(`
      ALTER TABLE "events"
      ADD CONSTRAINT "chk_events_status"
      CHECK ("status" IN (${this.enValues.map((v) => `'${v}'`).join(', ')}))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "events"
      DROP CONSTRAINT IF EXISTS "chk_events_status"
    `);
    await queryRunner.query(`ALTER TABLE "events" ALTER COLUMN "status" SET DEFAULT 'agendado'`);

    for (const [pt, en] of this.ptToEn) {
      await queryRunner.query(
        `UPDATE events SET status = $1, updated_at = now() WHERE status = $2`,
        [pt, en],
      );
    }
  }
}

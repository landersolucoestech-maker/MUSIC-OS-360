import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `leave_requests.status` (`LeaveRequestStatus` in
 * packages/types/src/enums.ts) is a plain `varchar(50)` with no CHECK
 * constraint, currently holding the PT-BR values `pendente` / `aprovado` /
 * `rejeitado` / `concluido`. Same atomic deploy model as
 * `20260910000003_BackfillAndRestrictArtistGoalStatusToEnglish`: schema + app
 * code ship together, so backfill + restrict are folded into one migration —
 * no live window where old PT-BR-writing app code and this migration's
 * English-only CHECK constraint coexist.
 *
 * Steps:
 *   1. Idempotently backfill existing rows from PT-BR to EN values (logs
 *      affected row count per value; matches only rows still holding an old
 *      value, so safe to re-run).
 *   2. Audit for any remaining unexpected value before adding the constraint.
 *   3. Add `chk_leave_requests_status` CHECK constraint restricting the
 *      column to the English enum values.
 */
export class BackfillAndRestrictLeaveRequestStatusToEnglish20260910000026
  implements MigrationInterface
{
  name = 'BackfillAndRestrictLeaveRequestStatusToEnglish20260910000026';

  private readonly ptToEn: Array<[string, string]> = [
    ['pendente', 'pending'],
    ['aprovado', 'approved'],
    ['rejeitado', 'rejected'],
    ['concluido', 'completed'],
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [pt, en] of this.ptToEn) {
      const [{ affected }] = await queryRunner.query(
        `WITH updated AS (
           UPDATE leave_requests SET status = $2, updated_at = now()
           WHERE status = $1
           RETURNING id
         )
         SELECT count(*)::int AS affected FROM updated`,
        [pt, en],
      );
      // eslint-disable-next-line no-console
      console.log(
        `[BackfillAndRestrictLeaveRequestStatusToEnglish] leave_requests.status '${pt}' -> '${en}': ${affected} row(s)`,
      );
    }

    const invalidRows: Array<{ status: string }> = await queryRunner.query(
      `SELECT DISTINCT status
       FROM "leave_requests"
       WHERE status NOT IN ('pending', 'approved', 'rejected', 'completed')`,
    );

    if (invalidRows.length > 0) {
      const invalidValues = invalidRows.map((row) => row.status).join(', ');
      throw new Error(
        `BackfillAndRestrictLeaveRequestStatusToEnglish20260910000026: cannot add CHECK constraint, ` +
          `"leave_requests" contains rows with unexpected status values after backfill: [${invalidValues}]. ` +
          `Fix or migrate this data before re-running this migration.`,
      );
    }

    await queryRunner.query(`
      ALTER TABLE "leave_requests"
      ADD CONSTRAINT "chk_leave_requests_status"
      CHECK ("status" IN ('pending', 'approved', 'rejected', 'completed'))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "leave_requests"
      DROP CONSTRAINT IF EXISTS "chk_leave_requests_status"
    `);

    for (const [pt, en] of this.ptToEn) {
      await queryRunner.query(
        `UPDATE leave_requests SET status = $1, updated_at = now() WHERE status = $2`,
        [pt, en],
      );
    }
  }
}

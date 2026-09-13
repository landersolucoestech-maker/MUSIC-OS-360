import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `employees.status` (`EmployeeStatus` in packages/types/src/enums.ts) is a
 * plain `varchar(50)` with no CHECK constraint, currently holding the PT-BR
 * values `ativo` / `inativo` / `ferias` / `licenca` / `demitido`. Same atomic
 * deploy model as `20260910000003_BackfillAndRestrictArtistGoalStatusToEnglish`:
 * schema + app code ship together, so backfill + restrict are folded into one
 * migration — no live window where old PT-BR-writing app code and this
 * migration's English-only CHECK constraint coexist.
 *
 * Steps:
 *   1. Idempotently backfill existing rows from PT-BR to EN values (logs
 *      affected row count per value; matches only rows still holding an old
 *      value, so safe to re-run).
 *   2. Audit for any remaining unexpected value before adding the constraint.
 *   3. Add `chk_employees_status` CHECK constraint restricting the column to
 *      the English enum values.
 */
export class BackfillAndRestrictEmployeeStatusToEnglish20260910000024
  implements MigrationInterface
{
  name = 'BackfillAndRestrictEmployeeStatusToEnglish20260910000024';

  private readonly ptToEn: Array<[string, string]> = [
    ['ativo', 'active'],
    ['inativo', 'inactive'],
    ['ferias', 'on_vacation'],
    ['licenca', 'on_leave'],
    ['demitido', 'terminated'],
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [pt, en] of this.ptToEn) {
      const [{ affected }] = await queryRunner.query(
        `WITH updated AS (
           UPDATE employees SET status = $2, updated_at = now()
           WHERE status = $1
           RETURNING id
         )
         SELECT count(*)::int AS affected FROM updated`,
        [pt, en],
      );
      // eslint-disable-next-line no-console
      console.log(
        `[BackfillAndRestrictEmployeeStatusToEnglish] employees.status '${pt}' -> '${en}': ${affected} row(s)`,
      );
    }

    const invalidRows: Array<{ status: string }> = await queryRunner.query(
      `SELECT DISTINCT status
       FROM "employees"
       WHERE status NOT IN ('active', 'inactive', 'on_vacation', 'on_leave', 'terminated')`,
    );

    if (invalidRows.length > 0) {
      const invalidValues = invalidRows.map((row) => row.status).join(', ');
      throw new Error(
        `BackfillAndRestrictEmployeeStatusToEnglish20260910000024: cannot add CHECK constraint, ` +
          `"employees" contains rows with unexpected status values after backfill: [${invalidValues}]. ` +
          `Fix or migrate this data before re-running this migration.`,
      );
    }

    await queryRunner.query(`
      ALTER TABLE "employees"
      ADD CONSTRAINT "chk_employees_status"
      CHECK ("status" IN ('active', 'inactive', 'on_vacation', 'on_leave', 'terminated'))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "employees"
      DROP CONSTRAINT IF EXISTS "chk_employees_status"
    `);

    for (const [pt, en] of this.ptToEn) {
      await queryRunner.query(
        `UPDATE employees SET status = $1, updated_at = now() WHERE status = $2`,
        [pt, en],
      );
    }
  }
}

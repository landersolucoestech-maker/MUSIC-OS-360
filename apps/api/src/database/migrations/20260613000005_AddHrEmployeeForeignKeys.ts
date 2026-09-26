import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * PHASE 2C.1 — Materializes the HR FKs left pending in 2C because they required
 * a business decision. Decision: ON DELETE RESTRICT (preserves history).
 *
 *   payroll_entries.employee_id → employees.id  (FINANCIAL/HR history)
 *   leave_requests.employee_id  → employees.id  (OPERATIONAL/HR history)
 *
 * Deleting an employee must NOT erase payroll, vacations or
 * leaves. Since `employees` uses soft delete (deleted_at), a physical deletion
 * must be BLOCKED while dependent history exists — exactly what
 * RESTRICT guarantees. CASCADE is forbidden in this domain.
 *
 * A READ-ONLY pre-check confirmed: compatible uuid↔uuid types, NOT NULL columns,
 * already existing indexes (idx_payroll_employee_id / idx_leave_employee_id),
 * no pre-existing FK and ZERO orphans. No data is changed; constraints
 * have explicit names and are reversible. No index created (they already exist).
 */
export class AddHrEmployeeForeignKeys20260613000005 implements MigrationInterface {
  name = 'AddHrEmployeeForeignKeys20260613000005';

  // [tabela, coluna, nome_constraint]
  private static readonly FKS: ReadonlyArray<[string, string, string]> = [
    ['payroll_entries', 'employee_id', 'fk_payroll_entries_employee_id'],
    ['leave_requests',  'employee_id', 'fk_leave_requests_employee_id'],
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [table, col, name] of AddHrEmployeeForeignKeys20260613000005.FKS) {
      // NOT VALID avoids a long validation lock; VALIDATE confirms integrity
      // (the pre-check guarantees zero orphans → always passes). No CASCADE: RESTRICT.
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD CONSTRAINT "${name}" ` +
        `FOREIGN KEY ("${col}") REFERENCES "employees" ("id") ON DELETE RESTRICT NOT VALID`,
      );
      await queryRunner.query(`ALTER TABLE "${table}" VALIDATE CONSTRAINT "${name}"`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const [table, , name] of AddHrEmployeeForeignKeys20260613000005.FKS) {
      await queryRunner.query(`ALTER TABLE "${table}" DROP CONSTRAINT IF EXISTS "${name}"`);
    }
  }
}

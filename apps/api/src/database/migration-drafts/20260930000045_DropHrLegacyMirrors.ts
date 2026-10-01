import { MigrationInterface, QueryRunner } from 'typeorm';
import { DropTablePlan, runDrop, runRestore } from './legacy-column-drop.base';

/**
 * DRAFT, GATED, NOT REGISTERED (LC1). employees.legacy_full_name / legacy_sector / legacy_base_salary, payroll_entries.legacy_employee_id / legacy_reference_month, leave_requests.legacy_employee_id (BLK-HR-LEGACY-MIRRORS). These archives hold PII (names, salary): same RLS lock-down, retention window must be set by the owner.
 * Skeleton, order, rollback and authorization checklist: docs/engineering/legacy-column-drop-plan.md
 * (shared implementation: ./legacy-column-drop.base.ts). Requires LEGACY_DROP_CONFIRM at execution time.
 */
export const PLANS: readonly DropTablePlan[] = [
  {
    table: 'employees',
    columns: [
      { name: 'legacy_full_name', type: 'varchar(150)' },
      { name: 'legacy_sector', type: 'varchar(100)' },
      { name: 'legacy_base_salary', type: 'numeric(15,2)' },
    ],
    checks: [
      { label: 'full_name_differs_from_name', where: '"legacy_full_name" IS NOT NULL AND "legacy_full_name" IS DISTINCT FROM "name"' },
      { label: 'sector_differs_from_department', where: '"legacy_sector" IS NOT NULL AND "legacy_sector" IS DISTINCT FROM "department"' },
      { label: 'base_salary_differs_from_salary', where: '"legacy_base_salary" IS NOT NULL AND "legacy_base_salary" IS DISTINCT FROM "salary"' },
    ],
  },
  {
    table: 'payroll_entries',
    columns: [
      { name: 'legacy_employee_id', type: 'uuid' },
      { name: 'legacy_reference_month', type: 'varchar(20)' },
    ],
    checks: [
      { label: 'employee_id_differs', where: '"legacy_employee_id" IS NOT NULL AND "legacy_employee_id" IS DISTINCT FROM "employee_id"' },
      { label: 'reference_month_differs', where: '"legacy_reference_month" IS NOT NULL AND "legacy_reference_month" IS DISTINCT FROM "reference_month"' },
    ],
  },
  {
    table: 'leave_requests',
    columns: [{ name: 'legacy_employee_id', type: 'uuid' }],
    checks: [{ label: 'employee_id_differs', where: '"legacy_employee_id" IS NOT NULL AND "legacy_employee_id" IS DISTINCT FROM "employee_id"' }],
  },
];

export class DropHrLegacyMirrors20260930000045 implements MigrationInterface {
  name = 'DropHrLegacyMirrors20260930000045';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await runDrop(queryRunner, this.name, PLANS);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await runRestore(queryRunner, this.name, PLANS);
  }
}

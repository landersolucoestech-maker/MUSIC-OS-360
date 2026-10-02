import { MigrationInterface, QueryRunner } from 'typeorm';
import { DropTablePlan, runDrop, runRestore } from './legacy-column-drop.base';

/**
 * DRAFT, GATED, NOT REGISTERED (LC1 G3). employees.rg / birth_date / address: plaintext personal data (identity document,
 * date of birth, home address of an employee) in physical columns that no code maps any more (EmployeeEntity has none of
 * them, the HR form inputs were removed). Added by 20260712000003 (rg, data_nascimento, endereco), renamed in place by
 * 20260928000008 (birth_date, address; rg keeps its name). Plan: docs/engineering/legacy-column-drop-plan.md (3.6 census).
 *
 * There is NO canonical counterpart to reconcile against (the values live only here), so the plan has no machine check:
 * the gate is the owner census (counts only) and the HR retention decision. The archive is the safety net, and it is
 * itself PII: `employees_pii_legacy_archive_20260930` (own name, because `employees_legacy_archive_20260930` already
 * belongs to draft 45), RLS ENABLED + FORCED, no policy, every app role revoked, `tenant_id` without a foreign key, listed
 * in the erasure SQL of backfill-side-tables-retention.md and retired by draft 52. down() restores the three columns by id
 * from the archive (rows created after the drop stay NULL).
 *
 * Independent of draft 45 (different columns, different archive); one destructive migration per deploy. Requires
 * LEGACY_DROP_CONFIRM at execution time (shared implementation: ./legacy-column-drop.base.ts).
 */
export const PLANS: readonly DropTablePlan[] = [
  {
    table: 'employees',
    archiveTable: 'employees_pii_legacy_archive_20260930',
    columns: [
      { name: 'rg', type: 'varchar(30)' },
      { name: 'birth_date', type: 'date' },
      { name: 'address', type: 'varchar(300)' },
    ],
    checks: [],
  },
];

export class DropEmployeesLegacyPiiColumns20260930000053 implements MigrationInterface {
  name = 'DropEmployeesLegacyPiiColumns20260930000053';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await runDrop(queryRunner, this.name, PLANS);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await runRestore(queryRunner, this.name, PLANS);
  }
}

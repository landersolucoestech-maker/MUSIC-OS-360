import { MigrationInterface, QueryRunner } from 'typeorm';
import { DropTablePlan, runDrop, runRestore } from './legacy-column-drop.base';

/**
 * DRAFT, GATED, NOT REGISTERED (LC1). invoices.legacy_amount. Requires 20260930000022 and 20260930000048 (NOT NULL relaxed) applied, plus the release that no longer writes or reads legacy_amount (stage 3 of the plan).
 * Skeleton, order, rollback and authorization checklist: docs/engineering/legacy-column-drop-plan.md
 * (shared implementation: ./legacy-column-drop.base.ts). Requires LEGACY_DROP_CONFIRM at execution time.
 */
export const PLANS: readonly DropTablePlan[] = [
  {
    table: 'invoices',
    columns: [{ name: 'legacy_amount', type: 'numeric(15,2)' }],
    checks: [
      { label: 'legacy_amount_without_service_amount', where: '"legacy_amount" IS NOT NULL AND "service_amount" IS NULL' },
      { label: 'legacy_amount_differs_from_service_amount', where: '"legacy_amount" IS NOT NULL AND "service_amount" IS NOT NULL AND "legacy_amount" <> "service_amount"' },
    ],
  },
];

export class DropInvoicesLegacyAmount20260930000049 implements MigrationInterface {
  name = 'DropInvoicesLegacyAmount20260930000049';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await runDrop(queryRunner, this.name, PLANS);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await runRestore(queryRunner, this.name, PLANS);
  }
}

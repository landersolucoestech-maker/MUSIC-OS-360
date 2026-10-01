import { MigrationInterface, QueryRunner } from 'typeorm';
import { DropTablePlan, runDrop, runRestore } from './legacy-column-drop.base';

/**
 * DRAFT, GATED, NOT REGISTERED (LC1). transactions.legacy_transaction_type / legacy_transaction_date / legacy_attachment_url / legacy_reference (BLK-TRANSACTIONS-LEGACY-DUPLICATES). Excludes the TX1 category taxonomy work (migration 18).
 * Skeleton, order, rollback and authorization checklist: docs/engineering/legacy-column-drop-plan.md
 * (shared implementation: ./legacy-column-drop.base.ts). Requires LEGACY_DROP_CONFIRM at execution time.
 */
export const PLANS: readonly DropTablePlan[] = [
  {
    table: 'transactions',
    columns: [
      { name: 'legacy_transaction_type', type: 'varchar(50)' },
      { name: 'legacy_transaction_date', type: 'date' },
      { name: 'legacy_attachment_url', type: 'text' },
      { name: 'legacy_reference', type: 'varchar(255)' },
    ],
    // type and transaction_date are NOT NULL, so presence of a canonical value is guaranteed by the schema; the
    // checks cover the two columns that were copied only when the canonical one was empty (20260928000021).
    checks: [
      { label: 'attachment_url_missing', where: '"legacy_attachment_url" IS NOT NULL AND "attachment_url" IS NULL' },
      { label: 'reference_not_in_notes', where: '"legacy_reference" IS NOT NULL AND "legacy_reference" <> \'\' AND "notes" IS NULL' },
    ],
  },
];

export class DropTransactionsLegacyColumns20260930000042 implements MigrationInterface {
  name = 'DropTransactionsLegacyColumns20260930000042';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await runDrop(queryRunner, this.name, PLANS);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await runRestore(queryRunner, this.name, PLANS);
  }
}

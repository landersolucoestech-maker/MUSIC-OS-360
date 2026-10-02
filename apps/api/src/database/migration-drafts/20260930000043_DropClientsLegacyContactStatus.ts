import { MigrationInterface, QueryRunner } from 'typeorm';
import { DropTablePlan, runDrop, runRestore } from './legacy-column-drop.base';

/**
 * DRAFT, GATED, NOT REGISTERED (LC1). clients.legacy_contact_status (BLK-CLIENTS-LEGACY-DUPLICATES).
 * Skeleton, order, rollback and authorization checklist: docs/engineering/legacy-column-drop-plan.md
 * (shared implementation: ./legacy-column-drop.base.ts). Requires LEGACY_DROP_CONFIRM at execution time.
 *
 * INFORMATIONAL PRECONDITION: the only machine check below catches a legacy value on a row with an empty status. It
 * is NOT proof that status carries the legacy information: migration 20260719000010 calls status distinct from
 * status_contato, so no canonical counterpart is proven. A pass is therefore vacuous for the semantic question.
 * The real gate is the owner-reviewed distinct (legacy_contact_status, status) PAIR CENSUS (counts only), required
 * by docs/engineering/legacy-column-drop-plan.md (clients) before LEGACY_DROP_CONFIRM may be set.
 */
export const PLANS: readonly DropTablePlan[] = [
  {
    table: 'clients',
    columns: [{ name: 'legacy_contact_status', type: 'varchar(40)' }],
    // The legacy value set is not mapped 1:1 onto status; the plan requires the distinct (legacy, status) pair census to be
    // reviewed by the owner (counts only). Machine check: no legacy value on a row whose status is empty.
    checks: [{
      label: 'contact_status_without_status',
      where: '"legacy_contact_status" IS NOT NULL AND ("status" IS NULL OR "status" = \'\')',
      informational: 'does not prove status carries the legacy value; the owner-reviewed (legacy, status) pair census is the gate',
    }],
  },
];

export class DropClientsLegacyContactStatus20260930000043 implements MigrationInterface {
  name = 'DropClientsLegacyContactStatus20260930000043';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await runDrop(queryRunner, this.name, PLANS);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await runRestore(queryRunner, this.name, PLANS);
  }
}

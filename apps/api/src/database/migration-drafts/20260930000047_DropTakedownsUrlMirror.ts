import { MigrationInterface, QueryRunner } from 'typeorm';
import { DropTablePlan, runDrop, runRestore } from './legacy-column-drop.base';

/**
 * DRAFT, GATED, NOT REGISTERED (LC1). takedowns.url (BLK-TAKEDOWNS-URL-MIRROR). Requires 20260930000022 applied everywhere AND the API/web release that stops writing/reading url.
 * Skeleton, order, rollback and authorization checklist: docs/engineering/legacy-column-drop-plan.md
 * (shared implementation: ./legacy-column-drop.base.ts). Requires LEGACY_DROP_CONFIRM at execution time.
 */
export const PLANS: readonly DropTablePlan[] = [
  {
    table: 'takedowns',
    columns: [{ name: 'url', type: 'text' }],
    checks: [{ label: 'url_differs_from_infringing_url', where: '"url" IS NOT NULL AND "infringing_url" IS DISTINCT FROM "url"' }],
  },
];

export class DropTakedownsUrlMirror20260930000047 implements MigrationInterface {
  name = 'DropTakedownsUrlMirror20260930000047';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await runDrop(queryRunner, this.name, PLANS);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await runRestore(queryRunner, this.name, PLANS);
  }
}

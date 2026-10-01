import { MigrationInterface, QueryRunner } from 'typeorm';
import { DropTablePlan, runDrop, runRestore } from './legacy-column-drop.base';

/**
 * DRAFT, GATED, NOT REGISTERED (LC1). shares.legacy_artist_project_id (BLK-SHARES-ARTIST-MIRROR).
 * Skeleton, order, rollback and authorization checklist: docs/engineering/legacy-column-drop-plan.md
 * (shared implementation: ./legacy-column-drop.base.ts). Requires LEGACY_DROP_CONFIRM at execution time.
 */
export const PLANS: readonly DropTablePlan[] = [
  {
    table: 'shares',
    columns: [{ name: 'legacy_artist_project_id', type: 'uuid' }],
    checks: [{ label: 'artist_project_id_differs_from_artist_id', where: '"legacy_artist_project_id" IS NOT NULL AND "artist_id" IS DISTINCT FROM "legacy_artist_project_id"' }],
  },
];

export class DropSharesLegacyArtistProjectId20260930000044 implements MigrationInterface {
  name = 'DropSharesLegacyArtistProjectId20260930000044';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await runDrop(queryRunner, this.name, PLANS);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await runRestore(queryRunner, this.name, PLANS);
  }
}

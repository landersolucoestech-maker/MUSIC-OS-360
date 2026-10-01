import { MigrationInterface, QueryRunner } from 'typeorm';
import { DropTablePlan, runDrop, runRestore } from './legacy-column-drop.base';

/**
 * DRAFT, GATED, NOT REGISTERED (LC1). phonograms.legacy_recording_date / legacy_release_date / legacy_duration_minutes / legacy_duration_seconds_part / legacy_origin_country (BLK-PHONOGRAMS-LEGACY-DUPLICATES).
 * Skeleton, order, rollback and authorization checklist: docs/engineering/legacy-column-drop-plan.md
 * (shared implementation: ./legacy-column-drop.base.ts). Requires LEGACY_DROP_CONFIRM at execution time.
 */
export const PLANS: readonly DropTablePlan[] = [
  {
    table: 'phonograms',
    columns: [
      { name: 'legacy_recording_date', type: 'date' },
      { name: 'legacy_release_date', type: 'date' },
      { name: 'legacy_duration_minutes', type: 'integer' },
      { name: 'legacy_duration_seconds_part', type: 'integer' },
      { name: 'legacy_origin_country', type: 'varchar(100)' },
    ],
    checks: [
      { label: 'recording_date_missing', where: '"legacy_recording_date" IS NOT NULL AND "recording_date" IS NULL' },
      { label: 'release_date_missing', where: '"legacy_release_date" IS NOT NULL AND "release_date" IS NULL' },
      { label: 'duration_seconds_missing', where: '("legacy_duration_minutes" IS NOT NULL OR "legacy_duration_seconds_part" IS NOT NULL) AND "duration_seconds" IS NULL' },
      { label: 'country_of_recording_missing', where: '"legacy_origin_country" IS NOT NULL AND "country_of_recording" IS NULL' },
    ],
  },
];

export class DropPhonogramsLegacyColumns20260930000041 implements MigrationInterface {
  name = 'DropPhonogramsLegacyColumns20260930000041';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await runDrop(queryRunner, this.name, PLANS);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await runRestore(queryRunner, this.name, PLANS);
  }
}

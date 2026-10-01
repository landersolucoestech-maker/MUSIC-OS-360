import { MigrationInterface, QueryRunner } from 'typeorm';
import { DropTablePlan, runDrop, runRestore } from './legacy-column-drop.base';

/**
 * DRAFT, GATED, NOT REGISTERED (LC1). works.legacy_language_label / legacy_instrumental_flag / legacy_ai_used / legacy_alternative_titles / legacy_lyrics (BLK-WORKS-LEGACY-DUPLICATES).
 * Skeleton, order, rollback and authorization checklist: docs/engineering/legacy-column-drop-plan.md
 * (shared implementation: ./legacy-column-drop.base.ts). Requires LEGACY_DROP_CONFIRM at execution time.
 */
export const PLANS: readonly DropTablePlan[] = [
  {
    table: 'works',
    columns: [
      { name: 'legacy_language_label', type: 'varchar(20)' },
      { name: 'legacy_instrumental_flag', type: 'varchar(10)' },
      { name: 'legacy_ai_used', type: 'boolean' },
      { name: 'legacy_alternative_titles', type: 'jsonb' },
      { name: 'legacy_lyrics', type: 'text' },
    ],
    // Rows whose legacy value has no canonical counterpart (20260928000018 filled canonical only where it was NULL).
    checks: [
      { label: 'language_label_without_language', where: '"legacy_language_label" IS NOT NULL AND "language" IS NULL' },
      { label: 'instrumental_flag_without_is_instrumental', where: '"legacy_instrumental_flag" IS NOT NULL AND "is_instrumental" IS NULL' },
      { label: 'ai_used_without_ai_used', where: '"legacy_ai_used" IS NOT NULL AND "ai_used" IS NULL' },
      { label: 'alternative_titles_without_alternative_titles', where: '"legacy_alternative_titles" IS NOT NULL AND "alternative_titles" IS NULL' },
      { label: 'lyrics_without_lyrics', where: '"legacy_lyrics" IS NOT NULL AND "lyrics" IS NULL' },
    ],
  },
];

export class DropWorksLegacyColumns20260930000040 implements MigrationInterface {
  name = 'DropWorksLegacyColumns20260930000040';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await runDrop(queryRunner, this.name, PLANS);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await runRestore(queryRunner, this.name, PLANS);
  }
}

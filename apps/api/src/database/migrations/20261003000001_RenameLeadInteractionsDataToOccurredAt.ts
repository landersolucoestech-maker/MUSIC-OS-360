import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20261003000001_RenameLeadInteractionsDataToOccurredAt
 *
 * lead_interactions.data is the moment the interaction happened (timestamp, default
 * CURRENT_TIMESTAMP), the Portuguese word for "date" used as a column name. The naming census could
 * not flag it because `data` is also an English word; the live-schema cross-check against the
 * canonical map found it. The canonical name is `occurred_at`.
 *
 * `RENAME COLUMN` is metadata-only in PostgreSQL (no rewrite, no data movement) and keeps the value,
 * default and position. Both directions are guarded with IF EXISTS so a re-run, or a schema where the
 * column is already renamed, is a no-op; the down() restores the legacy name by the same mechanism.
 * The API entity and the web reader change in the same release (the web reader also accepts the legacy
 * response field `data` while an older API is still deployed).
 */
export class RenameLeadInteractionsDataToOccurredAt20261003000001 implements MigrationInterface {
  name = 'RenameLeadInteractionsDataToOccurredAt20261003000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = current_schema() AND table_name = 'lead_interactions' AND column_name = 'data'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = current_schema() AND table_name = 'lead_interactions' AND column_name = 'occurred_at'
        ) THEN
          ALTER TABLE "lead_interactions" RENAME COLUMN "data" TO "occurred_at";
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = current_schema() AND table_name = 'lead_interactions' AND column_name = 'occurred_at'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = current_schema() AND table_name = 'lead_interactions' AND column_name = 'data'
        ) THEN
          ALTER TABLE "lead_interactions" RENAME COLUMN "occurred_at" TO "data";
        END IF;
      END $$;
    `);
  }
}

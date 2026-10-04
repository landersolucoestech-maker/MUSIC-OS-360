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
 *
 * Coexistence: the RENAME takes ACCESS EXCLUSIVE, so it runs under a 15s lock_timeout (it fails fast
 * instead of queueing behind a long transaction and stalling every reader and writer behind it). An
 * older API build still maps the column `data`; its lead_interactions reads and inserts fail from the
 * rename until those instances drain, so this migration must run in the same deploy that replaces the
 * API instances (the table is low-volume CRM history, not a hot path).
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
          SET LOCAL lock_timeout = '15s';
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
          SET LOCAL lock_timeout = '15s';
          ALTER TABLE "lead_interactions" RENAME COLUMN "occurred_at" TO "data";
        END IF;
      END $$;
    `);
  }
}

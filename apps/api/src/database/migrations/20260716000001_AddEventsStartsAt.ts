import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * C3 / Phase E1 — expansion (expand-and-contract) of events.data → events.starts_at.
 *
 * Adds the future canonical column `starts_at` with the SAME physical semantics as the
 * legacy `data` column (timestamp without time zone, default precision 6), but
 * nullable in this phase — NOT NULL only arrives in phase E5, after the dual-write (E2) and
 * the aborting backfill (E3). No data is copied here and `data` stays intact.
 */
export class AddEventsStartsAt20260716000001 implements MigrationInterface {
  name = 'AddEventsStartsAt20260716000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "events"
        ADD COLUMN IF NOT EXISTS "starts_at" timestamp
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_events_tenant_starts_at"
        ON "events" ("tenant_id", "starts_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_events_tenant_starts_at"`);
    await queryRunner.query(`ALTER TABLE "events" DROP COLUMN IF EXISTS "starts_at"`);
  }
}

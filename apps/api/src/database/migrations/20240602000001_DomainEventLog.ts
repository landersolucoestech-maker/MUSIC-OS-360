import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20240602000001_DomainEventLog
 *
 * Creates the `domain_event_log` table for append-only persistence of every
 * domain event emitted by the MUSIC OS 360 system.
 *
 * Fields:
 *   - aggregate_type / aggregate_id — traceability per domain entity
 *   - processed_at   — timestamp of processing by the handler (null = pending)
 *   - error          — error message if the handler failed
 *
 * The table is append-only: no soft delete, no updates (except processed_at/error).
 * Rollback: down() drops the table and indexes.
 */
export class DomainEventLog20240602000001 implements MigrationInterface {
  name = 'DomainEventLog20240602000001';

  async up(queryRunner: QueryRunner): Promise<void> {

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "domain_event_log" (
        "id"             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id"      UUID,
        "event_type"     VARCHAR(100) NOT NULL,
        "aggregate_type" VARCHAR(100),
        "aggregate_id"   VARCHAR(255),
        "actor_id"       VARCHAR(255),
        "correlation_id" VARCHAR(255),
        "payload"        JSONB        NOT NULL DEFAULT '{}',
        "occurred_at"    TIMESTAMP    NOT NULL DEFAULT NOW(),
        "processed_at"   TIMESTAMP,
        "error"          TEXT,
        "created_at"     TIMESTAMP    NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_del_tenant_id"
        ON "domain_event_log" ("tenant_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_del_tenant_event_type"
        ON "domain_event_log" ("tenant_id", "event_type")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_del_correlation_id"
        ON "domain_event_log" ("correlation_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_del_occurred_at"
        ON "domain_event_log" ("occurred_at" DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_del_aggregate"
        ON "domain_event_log" ("aggregate_type", "aggregate_id")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_del_aggregate"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_del_occurred_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_del_correlation_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_del_tenant_event_type"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_del_tenant_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "domain_event_log"`);
  }
}

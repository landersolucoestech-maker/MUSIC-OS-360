import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * find-32bf2e0a (Wave 11 cross-review): notifications.processor.ts deduped
 * BullMQ redelivery via a plain SELECT-then-INSERT on
 * metadata->>'bullmq_job_id', with no DB-level uniqueness. Under READ
 * COMMITTED, two concurrent workers processing a redelivered job (stalled-job
 * lock-TTL expiry while the first worker is still finishing) can both pass
 * the SELECT before either commits the INSERT, producing two notification
 * rows and two WS pushes for the same job. A partial UNIQUE index makes the
 * dedup atomic at the database level regardless of transaction interleaving.
 *
 * SAFETY: partial UNIQUE index — rows with no bullmq_job_id never
 * participate, so it cannot reject any existing/legacy notification.
 * Non-destructive: no existing row is altered. If duplicate
 * (tenant_id, bullmq_job_id) pairs already exist (from the pre-fix race),
 * index creation FAILS CLOSED at migration time rather than silently
 * succeeding over bad data.
 */
export class NotificationsBullmqJobIdUniqueness20260912000001 implements MigrationInterface {
  name = 'NotificationsBullmqJobIdUniqueness20260912000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_notifications_tenant_bullmq_job_id"
        ON "notifications" ("tenant_id", (("metadata" ->> 'bullmq_job_id')))
        WHERE "metadata" ->> 'bullmq_job_id' IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_notifications_tenant_bullmq_job_id"`);
  }
}

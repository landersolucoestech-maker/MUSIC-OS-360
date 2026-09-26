import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260822000000_FixSupportTicketsTenantIdUnique
 *
 * Migration bug discovered while verifying REM-02 (Remaining Product
 * Completion Backlog): `CreateSupportTicketMessages20260822000001` creates a
 * composite FK `(tenant_id, ticket_id) REFERENCES support_tickets
 * (tenant_id, id)`, but `support_tickets` (20240101000000_InitialSchema)
 * never received the `UNIQUE (tenant_id, id)` that other CRM tables
 * (clients, artists, contracts, ...) already have via the
 * `RebuildXInCanonicalFormOrder` migrations of 2026-07-19 — Postgres rejects the FK without
 * that unique index on the referenced side.
 *
 * Minimal, additive fix: only ADD CONSTRAINT UNIQUE (id is already the PK, so
 * the (tenant_id, id) pair is necessarily unique already — no existing data
 * can violate it). It is not a canonical-form-order rebuild (out of
 * scope here) — only enough to satisfy the following FK.
 * Must run before CreateSupportTicketMessages20260822000001.
 */
export class FixSupportTicketsTenantIdUnique20260822000000 implements MigrationInterface {
  name = 'FixSupportTicketsTenantIdUnique20260822000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "support_tickets"
      ADD CONSTRAINT "uq_support_tickets_tenant_id_id" UNIQUE ("tenant_id", "id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "support_tickets" DROP CONSTRAINT IF EXISTS "uq_support_tickets_tenant_id_id"`);
  }
}

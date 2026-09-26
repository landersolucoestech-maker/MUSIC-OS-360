import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260614000001_CreatePermissionGroups  (STEP 1 / Migration 001 — Enterprise RBAC)
 *
 * GLOBAL catalog of permission groups (domain for UX + governance).
 * - No tenant_id (platform capability, not tenant data) → no RLS.
 * - No soft delete (catalog managed by migrations/seeds).
 * - Additive and non-destructive. Idempotent. Reversible via down().
 *
 * STEP 1 scope: structure only. Seeding the groups belongs to the backfill stage (PHASE 4).
 */
export class CreatePermissionGroups20260614000001 implements MigrationInterface {
  name = 'CreatePermissionGroups20260614000001';

  async up(qr: QueryRunner): Promise<void> {
    await qr.query(`
      CREATE TABLE IF NOT EXISTS "permission_groups" (
        "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "key"        VARCHAR(64)  NOT NULL,
        "domain"     VARCHAR(64)  NOT NULL,
        "label"      VARCHAR(160) NOT NULL,
        "sort_order" INTEGER      NOT NULL DEFAULT 0,
        "created_at" TIMESTAMPTZ  NOT NULL DEFAULT now(),
        CONSTRAINT "uq_permission_groups_key" UNIQUE ("key"),
        CONSTRAINT "chk_permission_groups_key_fmt" CHECK ("key" ~ '^[a-z][a-z0-9_]*$')
      )
    `);
    await qr.query(`CREATE INDEX IF NOT EXISTS "idx_permission_groups_domain" ON "permission_groups" ("domain")`);
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP TABLE IF EXISTS "permission_groups"`);
  }
}

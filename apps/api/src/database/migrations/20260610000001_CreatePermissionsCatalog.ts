import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260610000001_CreatePermissionsCatalog  (M1 — PHASE 4 Enterprise RBAC)
 *
 * GLOBAL catalog of permissions in the `resource:action` format.
 * - No tenant_id (system capabilities, not tenant data).
 * - No soft delete (relation/catalog managed by migrations/seeds).
 * - Seeding the catalog is PHASE 8's responsibility; only the structure here.
 *
 * Idempotent. Reversible via down().
 */
export class CreatePermissionsCatalog20260610000001 implements MigrationInterface {
  name = 'CreatePermissionsCatalog20260610000001';

  async up(qr: QueryRunner): Promise<void> {
    await qr.query(`
      CREATE TABLE IF NOT EXISTS "permissions" (
        "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "resource"    VARCHAR(64)  NOT NULL,
        "action"      VARCHAR(64)  NOT NULL,
        "key"         VARCHAR(160) NOT NULL,
        "description" TEXT,
        "created_at"  TIMESTAMPTZ  NOT NULL DEFAULT now(),
        "updated_at"  TIMESTAMPTZ  NOT NULL DEFAULT now(),
        CONSTRAINT "uq_permissions_resource_action" UNIQUE ("resource", "action"),
        CONSTRAINT "uq_permissions_key"             UNIQUE ("key"),
        CONSTRAINT "chk_permissions_resource_fmt"   CHECK ("resource" ~ '^[a-z][a-z0-9_]*$'),
        CONSTRAINT "chk_permissions_action_fmt"     CHECK ("action"   ~ '^[a-z][a-z0-9_]*$'),
        CONSTRAINT "chk_permissions_key_fmt"        CHECK ("key" = "resource" || ':' || "action")
      )
    `);
    await qr.query(`CREATE INDEX IF NOT EXISTS "idx_permissions_resource" ON "permissions" ("resource")`);
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP TABLE IF EXISTS "permissions"`);
  }
}

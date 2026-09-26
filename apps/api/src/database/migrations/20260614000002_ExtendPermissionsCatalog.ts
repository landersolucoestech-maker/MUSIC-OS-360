import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260614000002_ExtendPermissionsCatalog  (STEP 1 / Migration 002 — Enterprise RBAC)
 *
 * Extends the GLOBAL `permissions` catalog (created in 20260610000001) with the
 * governance/group fields foreseen in the Definitive Physical Model.
 *
 * NON-DESTRUCTIVE:
 *   - Only ADD COLUMN IF NOT EXISTS (no existing column/constraint is changed).
 *   - The existing CHECK `chk_permissions_key_fmt` (key = resource || ':' || action) is
 *     PRESERVED intact — the `:`→`.` separator migration belongs to the (future) cutover stage.
 *   - `group_id` comes in NULLABLE on purpose: the table may already contain rows and the link to
 *     `permission_groups` is populated in the backfill stage (PHASE 4). Making it NOT NULL now
 *     would break existing rows — enforcing it is left for a migration after
 *     the backfill.
 *
 * Idempotent. Reversible via down().
 */
export class ExtendPermissionsCatalog20260614000002 implements MigrationInterface {
  name = 'ExtendPermissionsCatalog20260614000002';

  async up(qr: QueryRunner): Promise<void> {
    await qr.query(`
      ALTER TABLE "permissions"
        ADD COLUMN IF NOT EXISTS "group_id"        UUID,
        ADD COLUMN IF NOT EXISTS "label"           VARCHAR(160),
        ADD COLUMN IF NOT EXISTS "since_version"   INTEGER     NOT NULL DEFAULT 1,
        ADD COLUMN IF NOT EXISTS "deprecated_at"   TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS "replaced_by_key" VARCHAR(160),
        ADD COLUMN IF NOT EXISTS "is_assignable"   BOOLEAN     NOT NULL DEFAULT true
    `);

    // FK group_id → permission_groups (RESTRICT: do not delete a group with permissions).
    // Added idempotently (the column is nullable, hence safe over existing rows).
    await qr.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'fk_permissions_group'
        ) THEN
          ALTER TABLE "permissions"
            ADD CONSTRAINT "fk_permissions_group"
            FOREIGN KEY ("group_id") REFERENCES "permission_groups" ("id") ON DELETE RESTRICT;
        END IF;
      END $$;
    `);

    await qr.query(`CREATE INDEX IF NOT EXISTS "idx_permissions_group_id" ON "permissions" ("group_id")`);
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP INDEX IF EXISTS "idx_permissions_group_id"`);
    await qr.query(`ALTER TABLE "permissions" DROP CONSTRAINT IF EXISTS "fk_permissions_group"`);
    await qr.query(`
      ALTER TABLE "permissions"
        DROP COLUMN IF EXISTS "group_id",
        DROP COLUMN IF EXISTS "label",
        DROP COLUMN IF EXISTS "since_version",
        DROP COLUMN IF EXISTS "deprecated_at",
        DROP COLUMN IF EXISTS "replaced_by_key",
        DROP COLUMN IF EXISTS "is_assignable"
    `);
  }
}

import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260610000004_AlterOrgMembersAddRbacColumns  (M4 — PHASE 4 Enterprise RBAC)
 *
 * Evolves org_members (Membership) ADDITIVELY and non-destructively:
 *   role_id, department_id, position_id, deleted_at, created_by, updated_by — all NULLABLE.
 * Does NOT remove `role` (legacy string) — coexistence throughout the transition.
 *
 * Idempotent FKs via a pg_constraint guard (ADD CONSTRAINT has no portable IF NOT EXISTS).
 * Reversible via down() (removes only what this migration added).
 */
export class AlterOrgMembersAddRbacColumns20260610000004 implements MigrationInterface {
  name = 'AlterOrgMembersAddRbacColumns20260610000004';

  async up(qr: QueryRunner): Promise<void> {
    await qr.query(`
      ALTER TABLE "org_members"
        ADD COLUMN IF NOT EXISTS "role_id"       UUID,
        ADD COLUMN IF NOT EXISTS "department_id" UUID,
        ADD COLUMN IF NOT EXISTS "position_id"   UUID,
        ADD COLUMN IF NOT EXISTS "deleted_at"    TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS "created_by"    UUID,
        ADD COLUMN IF NOT EXISTS "updated_by"    UUID
    `);

    await qr.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_org_members_role') THEN
          ALTER TABLE "org_members" ADD CONSTRAINT "fk_org_members_role"
            FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_org_members_department') THEN
          ALTER TABLE "org_members" ADD CONSTRAINT "fk_org_members_department"
            FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_org_members_position') THEN
          ALTER TABLE "org_members" ADD CONSTRAINT "fk_org_members_position"
            FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE SET NULL;
        END IF;
      END $$
    `);

    await qr.query(`CREATE INDEX IF NOT EXISTS "idx_org_members_role_id"       ON "org_members" ("role_id")`);
    await qr.query(`CREATE INDEX IF NOT EXISTS "idx_org_members_department_id" ON "org_members" ("department_id")`);
    await qr.query(`CREATE INDEX IF NOT EXISTS "idx_org_members_position_id"   ON "org_members" ("position_id")`);
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP INDEX IF EXISTS "idx_org_members_role_id"`);
    await qr.query(`DROP INDEX IF EXISTS "idx_org_members_department_id"`);
    await qr.query(`DROP INDEX IF EXISTS "idx_org_members_position_id"`);
    await qr.query(`ALTER TABLE "org_members" DROP CONSTRAINT IF EXISTS "fk_org_members_role"`);
    await qr.query(`ALTER TABLE "org_members" DROP CONSTRAINT IF EXISTS "fk_org_members_department"`);
    await qr.query(`ALTER TABLE "org_members" DROP CONSTRAINT IF EXISTS "fk_org_members_position"`);
    await qr.query(`
      ALTER TABLE "org_members"
        DROP COLUMN IF EXISTS "role_id",
        DROP COLUMN IF EXISTS "department_id",
        DROP COLUMN IF EXISTS "position_id",
        DROP COLUMN IF EXISTS "deleted_at",
        DROP COLUMN IF EXISTS "created_by",
        DROP COLUMN IF EXISTS "updated_by"
    `);
    // Does NOT touch "role" (the legacy string remains).
  }
}

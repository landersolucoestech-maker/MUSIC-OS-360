import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260610000003_CreateOrgStructure  (M3 — PHASE 4 Enterprise RBAC)
 *
 * Org chart: departments, positions, job_functions.
 * - tenant_id MANDATORY; soft delete (deleted_at); auditing (created_by/updated_by).
 * - Partial UNIQUE per (tenant_id, slug) ignoring soft-deleted rows.
 * - CRITICAL RULE: NONE of these tables references role/permission (they grant no access).
 *
 * Idempotent. Reversible via down().
 */
export class CreateOrgStructure20260610000003 implements MigrationInterface {
  name = 'CreateOrgStructure20260610000003';

  async up(qr: QueryRunner): Promise<void> {
    // ── departments ─────────────────────────────────────────────────────────────
    await qr.query(`
      CREATE TABLE IF NOT EXISTS "departments" (
        "id"                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id"            UUID         NOT NULL,
        "parent_department_id" UUID,
        "slug"                 VARCHAR(64)  NOT NULL,
        "name"                 VARCHAR(120) NOT NULL,
        "description"          TEXT,
        "is_active"            BOOLEAN      NOT NULL DEFAULT TRUE,
        "sort_order"           INTEGER      NOT NULL DEFAULT 0,
        "created_at"           TIMESTAMPTZ  NOT NULL DEFAULT now(),
        "updated_at"           TIMESTAMPTZ  NOT NULL DEFAULT now(),
        "created_by"           UUID,
        "updated_by"           UUID,
        "deleted_at"           TIMESTAMPTZ,
        CONSTRAINT "fk_departments_tenant" FOREIGN KEY ("tenant_id")            REFERENCES "tenants"("id")     ON DELETE CASCADE,
        CONSTRAINT "fk_departments_parent" FOREIGN KEY ("parent_department_id") REFERENCES "departments"("id") ON DELETE SET NULL,
        CONSTRAINT "chk_departments_no_self_parent" CHECK ("parent_department_id" IS NULL OR "parent_department_id" <> "id")
      )
    `);
    await qr.query(`CREATE INDEX IF NOT EXISTS "idx_departments_tenant_id" ON "departments" ("tenant_id")`);
    await qr.query(`CREATE INDEX IF NOT EXISTS "idx_departments_parent"    ON "departments" ("parent_department_id")`);
    await qr.query(`CREATE UNIQUE INDEX IF NOT EXISTS "uq_departments_tenant_slug" ON "departments" ("tenant_id", "slug") WHERE "deleted_at" IS NULL`);

    // ── positions ───────────────────────────────────────────────────────────────
    await qr.query(`
      CREATE TABLE IF NOT EXISTS "positions" (
        "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id"     UUID         NOT NULL,
        "department_id" UUID,
        "slug"          VARCHAR(64)  NOT NULL,
        "name"          VARCHAR(120) NOT NULL,
        "description"   TEXT,
        "is_active"     BOOLEAN      NOT NULL DEFAULT TRUE,
        "sort_order"    INTEGER      NOT NULL DEFAULT 0,
        "created_at"    TIMESTAMPTZ  NOT NULL DEFAULT now(),
        "updated_at"    TIMESTAMPTZ  NOT NULL DEFAULT now(),
        "created_by"    UUID,
        "updated_by"    UUID,
        "deleted_at"    TIMESTAMPTZ,
        CONSTRAINT "fk_positions_tenant"     FOREIGN KEY ("tenant_id")     REFERENCES "tenants"("id")      ON DELETE CASCADE,
        CONSTRAINT "fk_positions_department" FOREIGN KEY ("department_id") REFERENCES "departments"("id")  ON DELETE SET NULL
      )
    `);
    await qr.query(`CREATE INDEX IF NOT EXISTS "idx_positions_tenant_id"     ON "positions" ("tenant_id")`);
    await qr.query(`CREATE INDEX IF NOT EXISTS "idx_positions_department_id" ON "positions" ("department_id")`);
    await qr.query(`CREATE UNIQUE INDEX IF NOT EXISTS "uq_positions_tenant_slug" ON "positions" ("tenant_id", "slug") WHERE "deleted_at" IS NULL`);

    // ── job_functions ───────────────────────────────────────────────────────────
    await qr.query(`
      CREATE TABLE IF NOT EXISTS "job_functions" (
        "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id"   UUID         NOT NULL,
        "slug"        VARCHAR(64)  NOT NULL,
        "name"        VARCHAR(120) NOT NULL,
        "category"    VARCHAR(64),
        "description" TEXT,
        "is_active"   BOOLEAN      NOT NULL DEFAULT TRUE,
        "created_at"  TIMESTAMPTZ  NOT NULL DEFAULT now(),
        "updated_at"  TIMESTAMPTZ  NOT NULL DEFAULT now(),
        "created_by"  UUID,
        "updated_by"  UUID,
        "deleted_at"  TIMESTAMPTZ,
        CONSTRAINT "fk_job_functions_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE
      )
    `);
    await qr.query(`CREATE INDEX IF NOT EXISTS "idx_job_functions_tenant_id" ON "job_functions" ("tenant_id")`);
    await qr.query(`CREATE UNIQUE INDEX IF NOT EXISTS "uq_job_functions_tenant_slug" ON "job_functions" ("tenant_id", "slug") WHERE "deleted_at" IS NULL`);
  }

  async down(qr: QueryRunner): Promise<void> {
    // positions depende de departments (FK) → dropar antes.
    await qr.query(`DROP TABLE IF EXISTS "positions"`);
    await qr.query(`DROP TABLE IF EXISTS "job_functions"`);
    await qr.query(`DROP TABLE IF EXISTS "departments"`);
  }
}

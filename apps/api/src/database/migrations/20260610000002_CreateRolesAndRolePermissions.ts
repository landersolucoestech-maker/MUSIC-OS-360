import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260610000002_CreateRolesAndRolePermissions  (M2 — PHASE 4 Enterprise RBAC)
 *
 * - roles: role catalog. tenant_id NULL = global/system role; non-null = tenant custom role.
 *   canonical_role_id resolves aliases (artista→artist, tenant_owner→owner) without deleting anything.
 *   hierarchy_level preserves the current ROLE_HIERARCHY EXACTLY (RolesGuard compatibility).
 * - role_permissions: N:N role↔permission, without duplicates (UNIQUE role_id,permission_id).
 *
 * Structural seed (NOT manual): inserts the 20 GLOBAL canonical roles (is_system=true) so that
 * the M6 backfill is self-sufficient. The role_permissions matrix (PHASE 8) is NOT populated here.
 *
 * Department/Position/JobFunction do NOT reference role/permission — only Role grants access.
 * Idempotent. Reversible via down().
 */
export class CreateRolesAndRolePermissions20260610000002 implements MigrationInterface {
  name = 'CreateRolesAndRolePermissions20260610000002';

  async up(qr: QueryRunner): Promise<void> {
    // ── roles ──────────────────────────────────────────────────────────────────
    await qr.query(`
      CREATE TABLE IF NOT EXISTS "roles" (
        "id"                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id"         UUID,
        "canonical_role_id" UUID,
        "slug"              VARCHAR(64)  NOT NULL,
        "name"              VARCHAR(120) NOT NULL,
        "description"       TEXT,
        "hierarchy_level"   INTEGER      NOT NULL DEFAULT 0,
        "is_system"         BOOLEAN      NOT NULL DEFAULT FALSE,
        "is_assignable"     BOOLEAN      NOT NULL DEFAULT TRUE,
        "created_at"        TIMESTAMPTZ  NOT NULL DEFAULT now(),
        "updated_at"        TIMESTAMPTZ  NOT NULL DEFAULT now(),
        "created_by"        UUID,
        "updated_by"        UUID,
        "deleted_at"        TIMESTAMPTZ,
        CONSTRAINT "fk_roles_tenant"    FOREIGN KEY ("tenant_id")         REFERENCES "tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_roles_canonical" FOREIGN KEY ("canonical_role_id") REFERENCES "roles"("id")   ON DELETE SET NULL,
        CONSTRAINT "chk_roles_hierarchy" CHECK ("hierarchy_level" BETWEEN 0 AND 100)
      )
    `);
    // Uniqueness: slug unique among global roles; and unique per tenant among custom ones (ignores soft-deleted).
    await qr.query(`CREATE UNIQUE INDEX IF NOT EXISTS "uq_roles_global_slug" ON "roles" ("slug")              WHERE "tenant_id" IS NULL     AND "deleted_at" IS NULL`);
    await qr.query(`CREATE UNIQUE INDEX IF NOT EXISTS "uq_roles_tenant_slug" ON "roles" ("tenant_id", "slug") WHERE "tenant_id" IS NOT NULL AND "deleted_at" IS NULL`);
    await qr.query(`CREATE INDEX IF NOT EXISTS "idx_roles_tenant_id" ON "roles" ("tenant_id")`);
    await qr.query(`CREATE INDEX IF NOT EXISTS "idx_roles_hierarchy" ON "roles" ("hierarchy_level")`);

    // ── role_permissions ────────────────────────────────────────────────────────
    await qr.query(`
      CREATE TABLE IF NOT EXISTS "role_permissions" (
        "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "role_id"       UUID NOT NULL,
        "permission_id" UUID NOT NULL,
        "created_at"    TIMESTAMPTZ NOT NULL DEFAULT now(),
        "created_by"    UUID,
        CONSTRAINT "fk_rp_role"       FOREIGN KEY ("role_id")       REFERENCES "roles"("id")       ON DELETE CASCADE,
        CONSTRAINT "fk_rp_permission" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE RESTRICT,
        CONSTRAINT "uq_role_permissions" UNIQUE ("role_id", "permission_id")
      )
    `);
    await qr.query(`CREATE INDEX IF NOT EXISTS "idx_rp_permission" ON "role_permissions" ("permission_id")`);

    // ── Structural seed: 20 global canonical roles (hierarchy_level == current ROLE_HIERARCHY) ──
    await qr.query(`
      INSERT INTO "roles" ("tenant_id", "slug", "name", "hierarchy_level", "is_system", "is_assignable")
      SELECT v.tenant_id, v.slug, v.name, v.lvl, TRUE, v.assignable
        FROM (VALUES
          (NULL::uuid, 'super_admin',       'Super Administrador',  100, FALSE),
          (NULL::uuid, 'tenant_owner',      'Proprietário do Tenant', 90, TRUE),
          (NULL::uuid, 'owner',             'Proprietário',          90, TRUE),
          (NULL::uuid, 'admin',             'Administrador',         80, TRUE),
          (NULL::uuid, 'manager',           'Gerente',               70, TRUE),
          (NULL::uuid, 'editor',            'Editor',                60, TRUE),
          (NULL::uuid, 'financial',         'Financeiro',            60, TRUE),
          (NULL::uuid, 'accounting',        'Contabilidade',         60, TRUE),
          (NULL::uuid, 'juridico',          'Jurídico',              55, TRUE),
          (NULL::uuid, 'marketing_manager', 'Gerente de Marketing',  55, TRUE),
          (NULL::uuid, 'rh_manager',        'Gerente de RH',         55, TRUE),
          (NULL::uuid, 'marketing',         'Marketing',             50, TRUE),
          (NULL::uuid, 'comercial',         'Comercial',             45, TRUE),
          (NULL::uuid, 'produtor',          'Produtor',              40, TRUE),
          (NULL::uuid, 'radio',             'Rádio',                 40, TRUE),
          (NULL::uuid, 'tv',                'TV',                    40, TRUE),
          (NULL::uuid, 'artist',            'Artista',               30, TRUE),
          (NULL::uuid, 'artista',           'Artista (legado)',      30, TRUE),
          (NULL::uuid, 'colaborador',       'Colaborador',           20, TRUE),
          (NULL::uuid, 'viewer',            'Visualizador',          10, TRUE)
        ) AS v(tenant_id, slug, name, lvl, assignable)
       WHERE NOT EXISTS (
         SELECT 1 FROM "roles" r
          WHERE r."slug" = v.slug AND r."tenant_id" IS NULL AND r."deleted_at" IS NULL
       )
    `);

    // Canonical aliases (not deleted; they only point to the canonical one).
    await qr.query(`
      UPDATE "roles" a
         SET "canonical_role_id" = c."id"
        FROM "roles" c
       WHERE a."tenant_id" IS NULL AND c."tenant_id" IS NULL
         AND a."canonical_role_id" IS NULL
         AND (
              (a."slug" = 'artista'      AND c."slug" = 'artist') OR
              (a."slug" = 'tenant_owner' AND c."slug" = 'owner')
         )
    `);
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP TABLE IF EXISTS "role_permissions"`);
    await qr.query(`DROP TABLE IF EXISTS "roles"`);
  }
}

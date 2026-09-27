import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260610000006_BackfillOrgMembersRoleId  (M6 — PHASE 4 Enterprise RBAC)
 *
 * Fills org_members.role_id from org_members.role (legacy string), using the global roles
 * seeded in M2 and the legacy→canonical map (artista→artist, tenant_owner→owner).
 * Values outside the map fall into 'viewer' (fail-safe). Does NOT change org_members.role.
 *
 * Idempotent (only touches role_id IS NULL). Does not depend on manual data. Emits a divergence report
 * via RAISE NOTICE. Reversible via down() (clears role_id; the legacy `role` source stays intact).
 */
export class BackfillOrgMembersRoleId20260610000006 implements MigrationInterface {
  name = 'BackfillOrgMembersRoleId20260610000006';

  async up(qr: QueryRunner): Promise<void> {
    // 1) Direct match by slug (includes the 'artista'/'tenant_owner' alias rows).
    await qr.query(`
      UPDATE "org_members" m
         SET "role_id" = r."id"
        FROM "roles" r
       WHERE r."tenant_id" IS NULL
         AND r."deleted_at" IS NULL
         AND r."slug" = m."role"
         AND m."role_id" IS NULL
    `);

    // 2) Resolves aliases to the canonical role (artista→artist, tenant_owner→owner).
    await qr.query(`
      UPDATE "org_members" m
         SET "role_id" = r."canonical_role_id"
        FROM "roles" r
       WHERE r."id" = m."role_id"
         AND r."canonical_role_id" IS NOT NULL
    `);

    // 3) Fail-safe: roles desconhecidos → viewer.
    await qr.query(`
      UPDATE "org_members" m
         SET "role_id" = v."id"
        FROM "roles" v
       WHERE v."tenant_id" IS NULL AND v."deleted_at" IS NULL AND v."slug" = 'viewer'
         AND m."role_id" IS NULL
    `);

    // 4) Divergence report (legacy roles without a canonical match).
    await qr.query(`
      DO $$
      DECLARE divergentes INTEGER;
      BEGIN
        SELECT COUNT(*) INTO divergentes
          FROM "org_members" m
          LEFT JOIN "roles" r
            ON r."tenant_id" IS NULL AND r."deleted_at" IS NULL AND r."slug" = m."role"
         WHERE r."id" IS NULL;
        RAISE NOTICE '[M6] Membros com role legado fora do mapa canonico (resolvidos para viewer): %', divergentes;
      END $$
    `);
  }

  async down(qr: QueryRunner): Promise<void> {
    // The legacy source of truth is org_members.role; clearing role_id is safe and reversible.
    await qr.query(`UPDATE "org_members" SET "role_id" = NULL`);
  }
}

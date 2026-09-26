import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260614000003_CreatePermissionAliases  (STEP 1 / Migration 003 — Enterprise RBAC)
 *
 * GLOBAL map of permission key aliases (legacy vocabulary → new), used in the backfill
 * and for compatibility during the cutover (e.g. `accounting:read` → `billing.read`).
 * - No tenant_id (platform catalog) → no RLS.
 * - Unique `legacy_key` (deterministic lookup in the backfill).
 * - Additive and non-destructive. Idempotent. Reversible via down().
 *
 * STEP 1 scope: structure only. Seeding the aliases belongs to the backfill stage (PHASE 4).
 */
export class CreatePermissionAliases20260614000003 implements MigrationInterface {
  name = 'CreatePermissionAliases20260614000003';

  async up(qr: QueryRunner): Promise<void> {
    await qr.query(`
      CREATE TABLE IF NOT EXISTS "permission_aliases" (
        "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "legacy_key" VARCHAR(160) NOT NULL,
        "new_key"    VARCHAR(160) NOT NULL,
        "created_at" TIMESTAMPTZ  NOT NULL DEFAULT now(),
        CONSTRAINT "uq_permission_aliases_legacy_key" UNIQUE ("legacy_key"),
        CONSTRAINT "chk_permission_aliases_distinct"  CHECK ("legacy_key" <> "new_key")
      )
    `);
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP TABLE IF EXISTS "permission_aliases"`);
  }
}

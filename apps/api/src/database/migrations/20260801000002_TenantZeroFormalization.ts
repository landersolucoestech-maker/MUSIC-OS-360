import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260801000002_TenantZeroFormalization  (Part 69 — LANDER RECORDS tenant-zero)
 *
 * Adds an explicit `is_system_tenant` column to `organizations` and
 * `tenants`, marking which row is the initial institutional tenant (LANDER
 * RECORDS). It is not an RLS/RBAC/billing bypass — no policy, guard or
 * business rule may read this column to grant access; it exists
 * only so the bootstrap (`bootstrap-tenant-zero.ts`) and administrative
 * tools can identify the row without depending on name, slug or
 * creation order (`ORDER BY created_at LIMIT 1` remains forbidden).
 *
 * The real constraint is in the partial unique index: since the index covers
 * only the rows where `is_system_tenant = true`, Postgres rejects
 * any second row with the same value — at most one tenant-zero per
 * table, always, regardless of what the application code does.
 *
 * Idempotent: `ADD COLUMN IF NOT EXISTS` / `CREATE UNIQUE INDEX IF NOT
 * EXISTS` are safe to run on existing databases (DEV/STAGING/PROD),
 * the `false` default promotes no existing tenant, and down() reverts
 * without deleting any tenant.
 */
export class TenantZeroFormalization20260801000002 implements MigrationInterface {
  name = 'TenantZeroFormalization20260801000002';

  async up(qr: QueryRunner): Promise<void> {
    await qr.query(`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS is_system_tenant boolean NOT NULL DEFAULT false`);
    await qr.query(`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS is_system_tenant boolean NOT NULL DEFAULT false`);

    await qr.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS organizations_single_system_tenant
      ON organizations (is_system_tenant)
      WHERE is_system_tenant = true
    `);
    await qr.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS tenants_single_system_tenant
      ON tenants (is_system_tenant)
      WHERE is_system_tenant = true
    `);
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP INDEX IF EXISTS tenants_single_system_tenant`);
    await qr.query(`DROP INDEX IF EXISTS organizations_single_system_tenant`);
    await qr.query(`ALTER TABLE tenants DROP COLUMN IF EXISTS is_system_tenant`);
    await qr.query(`ALTER TABLE organizations DROP COLUMN IF EXISTS is_system_tenant`);
  }
}

import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260610000007_EnableRlsOnRbacTables  (M7 — PHASE 4 Enterprise RBAC)
 *
 * Enables RLS following the EXISTING pattern (private_get_tenant_id() + super_admin_full_access), created in
 * 20260520000020_RLSPolicies (runs before this one).
 *
 *  - departments, positions, job_functions, membership_job_functions → tenant_isolation (FORCE RLS).
 *  - roles → globals (tenant_id IS NULL) visible to everyone; writes only in the own tenant.
 *  - permissions and role_permissions → NO RLS (global catalog; no tenant_id — decision D3).
 *    The API connects via the service role; RLS is the 2nd defense for direct PostgREST/Realtime connections.
 *  - org_members already has adequate RLS since 20260520000020 — not touched again.
 *
 * Idempotent (DROP POLICY IF EXISTS before CREATE). Reversible via down().
 */
export class EnableRlsOnRbacTables20260610000007 implements MigrationInterface {
  name = 'EnableRlsOnRbacTables20260610000007';

  private readonly TENANT_TABLES = [
    'departments',
    'positions',
    'job_functions',
    'membership_job_functions',
  ];

  async up(qr: QueryRunner): Promise<void> {
    // ── Tenant-scoped tables: pattern identical to RLSPolicies ───────────────────
    for (const table of this.TENANT_TABLES) {
      await qr.query(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
      await qr.query(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY`);
      await qr.query(`DROP POLICY IF EXISTS "tenant_isolation"       ON "${table}"`);
      await qr.query(`DROP POLICY IF EXISTS "super_admin_full_access" ON "${table}"`);
      await qr.query(`
        CREATE POLICY "super_admin_full_access" ON "${table}"
          FOR ALL TO authenticated
          USING ((auth.jwt()->'app_metadata'->>'role')::text = 'super_admin')
          WITH CHECK ((auth.jwt()->'app_metadata'->>'role')::text = 'super_admin')
      `);
      await qr.query(`
        CREATE POLICY "tenant_isolation" ON "${table}"
          FOR ALL TO authenticated
          USING (tenant_id = private_get_tenant_id())
          WITH CHECK (tenant_id = private_get_tenant_id())
      `);
    }

    // ── roles: globals visible (tenant_id NULL); custom ones isolated per tenant ─────
    await qr.query(`ALTER TABLE "roles" ENABLE ROW LEVEL SECURITY`);
    await qr.query(`ALTER TABLE "roles" FORCE ROW LEVEL SECURITY`);
    await qr.query(`DROP POLICY IF EXISTS "roles_visibility"        ON "roles"`);
    await qr.query(`DROP POLICY IF EXISTS "super_admin_full_access" ON "roles"`);
    await qr.query(`
      CREATE POLICY "super_admin_full_access" ON "roles"
        FOR ALL TO authenticated
        USING ((auth.jwt()->'app_metadata'->>'role')::text = 'super_admin')
        WITH CHECK ((auth.jwt()->'app_metadata'->>'role')::text = 'super_admin')
    `);
    await qr.query(`
      CREATE POLICY "roles_visibility" ON "roles"
        FOR ALL TO authenticated
        USING ("tenant_id" IS NULL OR "tenant_id" = private_get_tenant_id())
        WITH CHECK ("tenant_id" = private_get_tenant_id())
    `);
  }

  async down(qr: QueryRunner): Promise<void> {
    for (const table of this.TENANT_TABLES) {
      await qr.query(`DROP POLICY IF EXISTS "tenant_isolation"       ON "${table}"`);
      await qr.query(`DROP POLICY IF EXISTS "super_admin_full_access" ON "${table}"`);
      await qr.query(`ALTER TABLE "${table}" DISABLE ROW LEVEL SECURITY`);
    }
    await qr.query(`DROP POLICY IF EXISTS "roles_visibility"        ON "roles"`);
    await qr.query(`DROP POLICY IF EXISTS "super_admin_full_access" ON "roles"`);
    await qr.query(`ALTER TABLE "roles" DISABLE ROW LEVEL SECURITY`);
  }
}

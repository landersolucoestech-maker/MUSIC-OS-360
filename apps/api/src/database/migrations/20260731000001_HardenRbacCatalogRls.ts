import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260731000001_HardenRbacCatalogRls  (Part 58 — Security Advisor remediation)
 *
 * Adds fail-closed RLS to the 8 RBAC catalog tables left out of
 * 20260610000007_EnableRlsOnRbacTables (decision D3: global catalogs, no
 * tenant_id, so tenant_isolation doesn't apply). This is defense-in-depth
 * only — table-level GRANTs already deny anon/authenticated on every one of
 * these tables (see 20260613000017_HardenRbacAclDefaults' default-privilege
 * REVOKE, which applies to every table created after it, plus this
 * migration's own explicit REVOKEs for idempotency/certainty). RLS closes
 * the gap for direct PostgREST/Realtime access and matches the pattern
 * already used on rbac_decision_logs (20260614000008).
 *
 * Two access patterns, verified against actual runtime usage
 * (apps/api/src/core/rbac/permission-resolver.service.ts queries these
 * tables through DATA_SOURCE, which in production is the `musicos_app`
 * role — LOGIN NOBYPASSRLS, member of `authenticated`. Enabling RLS with
 * zero policies would silently deny-all musicos_app too, breaking live
 * authorization — NOT just PostgREST/anon/authenticated):
 *
 *  - permissions, role_permissions, permission_dependencies,
 *    permission_conflicts: read on the hot permission-resolution path via
 *    musicos_app (existing GRANTs are SELECT-only on permissions/
 *    permission_dependencies/permission_conflicts, SELECT+INSERT+DELETE on
 *    role_permissions — see 20260613000017 and 20260614000005). A
 *    `musicos_app_access` policy preserves exactly that access; it does not
 *    widen it (GRANTs remain the operation-level boundary, the policy only
 *    ungates rows).
 *  - role_templates, role_template_permissions: no application code
 *    currently queries them, but 20260614000004 already grants musicos_app
 *    SELECT. Same policy added so that existing grant keeps working if/when
 *    it's used, instead of silently becoming deny-all.
 *  - permission_groups, permission_aliases: no application code touches
 *    them and no musicos_app grant exists on either — bare RLS + REVOKE
 *    (no policy), identical to the rbac_decision_logs precedent, is exactly
 *    equivalent to current reality (owner-only access).
 *
 * super_admin is not special-cased here: nothing in the app queries these
 * tables through a super_admin-flagged authenticated session (they're not
 * exposed via PostgREST to authenticated at all), so there is no access
 * path that needs it, unlike roles/departments/etc. in
 * 20260610000007_EnableRlsOnRbacTables.
 *
 * Idempotent (DROP POLICY IF EXISTS before CREATE, guarded REVOKE/GRANT
 * blocks). Reversible via down() — restores the pre-migration RLS-disabled
 * state; does not touch the underlying GRANTs, which are owned by earlier
 * migrations.
 */
export class HardenRbacCatalogRls20260731000001 implements MigrationInterface {
  name = 'HardenRbacCatalogRls20260731000001';

  private readonly MUSICOS_APP_TABLES = [
    'permissions',
    'role_permissions',
    'permission_dependencies',
    'permission_conflicts',
    'role_templates',
    'role_template_permissions',
  ];

  private readonly LOCKED_TABLES = ['permission_groups', 'permission_aliases'];

  async up(qr: QueryRunner): Promise<void> {
    for (const table of [...this.MUSICOS_APP_TABLES, ...this.LOCKED_TABLES]) {
      await qr.query(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
      await qr.query(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY`);
      await qr.query(`
        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
            REVOKE ALL ON TABLE "${table}" FROM anon;
          END IF;
          IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
            REVOKE ALL ON TABLE "${table}" FROM authenticated;
          END IF;
        END
        $$
      `);
    }

    for (const table of this.MUSICOS_APP_TABLES) {
      await qr.query(`DROP POLICY IF EXISTS "musicos_app_access" ON "${table}"`);
      await qr.query(`
        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'musicos_app') THEN
            EXECUTE 'CREATE POLICY "musicos_app_access" ON "${table}"
                     FOR ALL TO musicos_app USING (true) WITH CHECK (true)';
          END IF;
        END
        $$
      `);
    }
  }

  async down(qr: QueryRunner): Promise<void> {
    for (const table of this.MUSICOS_APP_TABLES) {
      await qr.query(`DROP POLICY IF EXISTS "musicos_app_access" ON "${table}"`);
    }
    for (const table of [...this.MUSICOS_APP_TABLES, ...this.LOCKED_TABLES]) {
      await qr.query(`ALTER TABLE "${table}" NO FORCE ROW LEVEL SECURITY`);
      await qr.query(`ALTER TABLE "${table}" DISABLE ROW LEVEL SECURITY`);
    }
  }
}

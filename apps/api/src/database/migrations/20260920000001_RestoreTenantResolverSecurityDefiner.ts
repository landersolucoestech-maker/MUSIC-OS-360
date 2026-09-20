import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Forensic audit (2026-09-20) found app_current_tenant_id()/private_get_tenant_id()
 * live on DEV without SECURITY DEFINER, even though every versioned migration that
 * (re)creates them -- 20260520000020_RLSPolicies, 20260522000001_FixRLSFallback,
 * 20260612000001_PortableRlsTenantContext, 20260620000002_HardenContactsLeadUploadsRls
 * (the chronologically last one to touch them) -- explicitly declares it. A committed
 * live-schema snapshot (docs/backend-v2/database-inventory/functions-triggers.md,
 * dated 2026-08-30) already shows SECURITY_DEFINER=false for both, so the drift
 * predates this session by weeks; no versioned migration, repo-tracked SQL dump, or
 * operational/provisioning script was found that would explain it (git history of
 * every migration touching these functions confirmed SECURITY DEFINER present in each;
 * category A ruled out; exact out-of-band mechanism NOT determinable from repo
 * evidence -- category E).
 *
 * Whether SECURITY DEFINER is actually load-bearing (not just historical) was verified
 * live, not assumed: app_current_tenant_id()'s only privileged-table query is
 * `SELECT id FROM public.tenants WHERE org_id = <jwt org_id> AND deleted_at IS NULL`
 * (the JWT-fallback path, used when no `app.current_tenant_id` session var is set --
 * i.e. direct Supabase Data API / Realtime access, not the NestJS backend's own
 * request path, which sets the session var itself). Two live facts combine to make
 * restoring SECURITY DEFINER both NECESSARY and SAFE:
 *   1. `authenticated` has NO base table-level GRANT on `tenants` (only musicos_app/
 *      musicos_migrator do, per information_schema.role_table_grants) -- so today,
 *      without SECURITY DEFINER, that fallback query errors with "permission denied
 *      for table tenants" for any real Supabase-authenticated caller, rather than
 *      gracefully returning NULL. This is a functional break of the Data API path
 *      this repo's own HardenSupabaseDataApiSurface/RealtimeBroadcastAuthorization
 *      migrations confirm is real and intentionally supported -- not merely
 *      defense-in-depth.
 *   2. `tenants`' own RLS policy (`org_isolation: org_id = app_current_org_id()`,
 *      itself JWT-derived with no table lookup, hence no circularity) is textually
 *      IDENTICAL to app_current_tenant_id()'s WHERE clause -- so running as the
 *      function's owner (SECURITY DEFINER) exposes no row that RLS as the caller
 *      would not have exposed anyway. search_path is already pinned to pg_catalog
 *      (confirmed live) and PUBLIC EXECUTE is already revoked (confirmed via
 *      pg_proc.proacl) -- both preconditions for SECURITY DEFINER being safe here.
 *
 * Non-destructive: ALTER FUNCTION ... SECURITY DEFINER changes only that property,
 * not the function body/logic (already confirmed identical to the defining
 * migration via pg_get_functiondef) -- no table or row is touched. Idempotent:
 * ALTER FUNCTION is a plain property set, safe to run against a database already
 * in either state.
 */
export class RestoreTenantResolverSecurityDefiner20260920000001 implements MigrationInterface {
  name = 'RestoreTenantResolverSecurityDefiner20260920000001';

  private readonly FUNCTIONS = ['app_current_tenant_id', 'private_get_tenant_id'] as const;

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const fn of this.FUNCTIONS) {
      await queryRunner.query(`
        DO $$
        BEGIN
          IF to_regprocedure('public.${fn}()') IS NOT NULL THEN
            ALTER FUNCTION public.${fn}() SECURITY DEFINER;
            ALTER FUNCTION public.${fn}() SET search_path = pg_catalog;
            REVOKE ALL ON FUNCTION public.${fn}() FROM PUBLIC;
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
              GRANT EXECUTE ON FUNCTION public.${fn}() TO authenticated;
            END IF;
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
              GRANT EXECUTE ON FUNCTION public.${fn}() TO service_role;
            END IF;
          END IF;
        END $$
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const fn of this.FUNCTIONS) {
      await queryRunner.query(`
        DO $$
        BEGIN
          IF to_regprocedure('public.${fn}()') IS NOT NULL THEN
            ALTER FUNCTION public.${fn}() SECURITY INVOKER;
          END IF;
        END $$
      `);
    }
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Hardens the Supabase Data API surface discovered by the production advisors.
 *
 * The web application uses Supabase for Auth, but domain data is served through
 * the NestJS API. Anonymous Data API access is therefore unnecessary and must
 * not be inherited from broad/default grants.
 */
export class HardenSupabaseDataApiSurface20260620000006 implements MigrationInterface {
  name = 'HardenSupabaseDataApiSurface20260620000006';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
      REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;

      ALTER DEFAULT PRIVILEGES IN SCHEMA public
        REVOKE ALL ON TABLES FROM anon;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public
        REVOKE ALL ON SEQUENCES FROM anon;

      DO $$
      BEGIN
        IF to_regclass('public.artist_platform_profiles') IS NOT NULL THEN
          ALTER TABLE public.artist_platform_profiles ENABLE ROW LEVEL SECURITY;
          ALTER TABLE public.artist_platform_profiles FORCE ROW LEVEL SECURITY;

          DROP POLICY IF EXISTS artist_platform_profiles_select_tenant
            ON public.artist_platform_profiles;
          DROP POLICY IF EXISTS artist_platform_profiles_insert_tenant
            ON public.artist_platform_profiles;
          DROP POLICY IF EXISTS artist_platform_profiles_update_tenant
            ON public.artist_platform_profiles;
          DROP POLICY IF EXISTS artist_platform_profiles_delete_tenant
            ON public.artist_platform_profiles;

          CREATE POLICY artist_platform_profiles_select_tenant
            ON public.artist_platform_profiles FOR SELECT TO authenticated
            USING (tenant_id = (SELECT public.private_get_tenant_id()));
          CREATE POLICY artist_platform_profiles_insert_tenant
            ON public.artist_platform_profiles FOR INSERT TO authenticated
            WITH CHECK (tenant_id = (SELECT public.private_get_tenant_id()));
          CREATE POLICY artist_platform_profiles_update_tenant
            ON public.artist_platform_profiles FOR UPDATE TO authenticated
            USING (tenant_id = (SELECT public.private_get_tenant_id()))
            WITH CHECK (tenant_id = (SELECT public.private_get_tenant_id()));
          CREATE POLICY artist_platform_profiles_delete_tenant
            ON public.artist_platform_profiles FOR DELETE TO authenticated
            USING (tenant_id = (SELECT public.private_get_tenant_id()));

          GRANT SELECT, INSERT, UPDATE, DELETE
            ON public.artist_platform_profiles TO authenticated;
        END IF;

        IF to_regclass('public.organization_members') IS NOT NULL THEN
          ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
          ALTER TABLE public.organization_members FORCE ROW LEVEL SECURITY;
          REVOKE ALL ON public.organization_members FROM authenticated;
        END IF;

        IF to_regclass('public.musicos360_migrations') IS NOT NULL THEN
          ALTER TABLE public.musicos360_migrations ENABLE ROW LEVEL SECURITY;

          -- TypeORM's own bookkeeping: without this policy, FORCE RLS below
          -- would block the INSERT the next migration makes to
          -- register itself — even the table owner (musicos_migrator) is subject to
          -- FORCE RLS. Restricted exclusively to musicos_migrator; no
          -- other role (authenticated/anon/musicos_app/service_role/PUBLIC)
          -- gets runtime access through here.
          DROP POLICY IF EXISTS migrator_admin_all ON public.musicos360_migrations;
          IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'musicos_migrator') THEN
            CREATE POLICY migrator_admin_all
              ON public.musicos360_migrations
              FOR ALL TO musicos_migrator
              USING (true) WITH CHECK (true);
          END IF;

          ALTER TABLE public.musicos360_migrations FORCE ROW LEVEL SECURITY;
          REVOKE ALL ON public.musicos360_migrations FROM authenticated;
        END IF;
      END $$;

      DO $$
      BEGIN
        IF to_regprocedure('public.private_get_tenant_id()') IS NOT NULL THEN
          ALTER FUNCTION public.private_get_tenant_id() SET search_path = pg_catalog;
          REVOKE ALL ON FUNCTION public.private_get_tenant_id() FROM PUBLIC, anon;
          GRANT EXECUTE ON FUNCTION public.private_get_tenant_id() TO authenticated;
        END IF;

        IF to_regprocedure('public.auth_org_id()') IS NOT NULL THEN
          ALTER FUNCTION public.auth_org_id() SET search_path = pg_catalog;
          REVOKE ALL ON FUNCTION public.auth_org_id() FROM PUBLIC, anon;
          GRANT EXECUTE ON FUNCTION public.auth_org_id() TO authenticated;
        END IF;

        IF to_regprocedure('public.auth_org_role()') IS NOT NULL THEN
          ALTER FUNCTION public.auth_org_role() SET search_path = pg_catalog;
          REVOKE ALL ON FUNCTION public.auth_org_role() FROM PUBLIC, anon;
          GRANT EXECUTE ON FUNCTION public.auth_org_role() TO authenticated;
        END IF;

        IF to_regprocedure('public.has_min_role(text)') IS NOT NULL THEN
          ALTER FUNCTION public.has_min_role(text) SET search_path = pg_catalog;
          REVOKE ALL ON FUNCTION public.has_min_role(text) FROM PUBLIC, anon;
          GRANT EXECUTE ON FUNCTION public.has_min_role(text) TO authenticated;
        END IF;

        IF to_regprocedure('public.fn_audit_logs_immutable()') IS NOT NULL THEN
          ALTER FUNCTION public.fn_audit_logs_immutable() SET search_path = pg_catalog;
          REVOKE ALL ON FUNCTION public.fn_audit_logs_immutable()
            FROM PUBLIC, anon, authenticated;
        END IF;
      END $$;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // Reverts exclusively the administrative policy added in this fix.
    // The rest of this migration's hardening remains intentionally
    // irreversible: restoring anonymous grants would reopen the public surface
    // and would require its own explicit migration.
    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('public.musicos360_migrations') IS NOT NULL THEN
          DROP POLICY IF EXISTS migrator_admin_all ON public.musicos360_migrations;
        END IF;
      END $$;
    `);
  }
}

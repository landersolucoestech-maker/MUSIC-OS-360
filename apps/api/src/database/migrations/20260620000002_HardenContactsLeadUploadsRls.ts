import type { MigrationInterface, QueryRunner } from 'typeorm';

const TENANT_TABLES = [
  'contacts',
  'contact_attachments',
  'contact_contracts',
  'contact_timeline',
  'lead_uploads',
] as const;

const RBAC_LOG_RELATIONS = [
  'rbac_decision_logs',
  'rbac_decision_logs_2026_05',
  'rbac_decision_logs_2026_06',
  'rbac_decision_logs_2026_07',
  'rbac_decision_logs_2026_08',
  'rbac_decision_logs_default',
] as const;

export class HardenContactsLeadUploadsRls20260620000002
  implements MigrationInterface
{
  name = 'HardenContactsLeadUploadsRls20260620000002';

  async up(qr: QueryRunner): Promise<void> {
    await this.hardenTenantResolvers(qr);
    await this.addTenantRelationshipConstraints(qr);

    for (const table of TENANT_TABLES) {
      await qr.query(`ALTER TABLE public."${table}" ENABLE ROW LEVEL SECURITY`);
      await qr.query(`ALTER TABLE public."${table}" FORCE ROW LEVEL SECURITY`);

      await qr.query(`
        DO $do$
        DECLARE
          has_authenticated boolean;
          has_musicos_app boolean;
          policy_roles text;
        BEGIN
          SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') INTO has_authenticated;
          SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'musicos_app') INTO has_musicos_app;

          EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', '${table}_tenant_select', '${table}');
          EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', '${table}_tenant_insert', '${table}');
          EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', '${table}_tenant_update', '${table}');
          EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', '${table}_tenant_delete', '${table}');

          -- A policy name is unique per table (not per role): when both
          -- roles exist at the same time, the policy is created ONCE with
          -- the combined role list, instead of two policies with the same name.
          policy_roles := concat_ws(', ',
            CASE WHEN has_authenticated THEN 'authenticated' END,
            CASE WHEN has_musicos_app THEN 'musicos_app' END
          );

          IF policy_roles IS NOT NULL THEN
            EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO %s USING ("tenant_id" = (SELECT public.app_current_tenant_id()))', '${table}_tenant_select', '${table}', policy_roles);
            EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO %s WITH CHECK ("tenant_id" = (SELECT public.app_current_tenant_id()))', '${table}_tenant_insert', '${table}', policy_roles);
            EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO %s USING ("tenant_id" = (SELECT public.app_current_tenant_id())) WITH CHECK ("tenant_id" = (SELECT public.app_current_tenant_id()))', '${table}_tenant_update', '${table}', policy_roles);
            EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO %s USING ("tenant_id" = (SELECT public.app_current_tenant_id()))', '${table}_tenant_delete', '${table}', policy_roles);
          END IF;

          EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM PUBLIC', '${table}');
          IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
            EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM anon', '${table}');
          END IF;
          IF has_authenticated THEN
            EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM authenticated', '${table}');
            EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated', '${table}');
          END IF;
          IF has_musicos_app THEN
            EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM musicos_app', '${table}');
            EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO musicos_app', '${table}');
          END IF;
        END
        $do$;
      `);
    }

    for (const relation of RBAC_LOG_RELATIONS) {
      await qr.query(`
        DO $do$
        BEGIN
          IF to_regclass('public.${relation}') IS NOT NULL THEN
            EXECUTE 'REVOKE ALL PRIVILEGES ON TABLE public."${relation}" FROM PUBLIC';
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
              EXECUTE 'REVOKE ALL PRIVILEGES ON TABLE public."${relation}" FROM anon';
            END IF;
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
              EXECUTE 'REVOKE ALL PRIVILEGES ON TABLE public."${relation}" FROM authenticated';
            END IF;
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'musicos_app') THEN
              EXECUTE 'REVOKE ALL PRIVILEGES ON TABLE public."${relation}" FROM musicos_app';
            END IF;
          END IF;
        END
        $do$;
      `);
    }
  }

  async down(qr: QueryRunner): Promise<void> {
    for (const table of TENANT_TABLES) {
      for (const operation of ['select', 'insert', 'update', 'delete']) {
        await qr.query(
          `DROP POLICY IF EXISTS "${table}_tenant_${operation}" ON public."${table}"`,
        );
      }
      await qr.query(`ALTER TABLE public."${table}" NO FORCE ROW LEVEL SECURITY`);
      await qr.query(`ALTER TABLE public."${table}" DISABLE ROW LEVEL SECURITY`);
    }

    for (const [table, constraint] of [
      ['contact_attachments', 'fk_contact_attachments_contact_tenant'],
      ['contact_contracts', 'fk_contact_contracts_contact_tenant'],
      ['contact_contracts', 'fk_contact_contracts_contract_tenant'],
      ['contact_timeline', 'fk_contact_timeline_contact_tenant'],
      ['lead_uploads', 'fk_lead_uploads_lead_tenant'],
    ] as const) {
      await qr.query(
        `ALTER TABLE public."${table}" DROP CONSTRAINT IF EXISTS "${constraint}"`,
      );
    }

    await qr.query(`DROP INDEX IF EXISTS public."ux_contacts_id_tenant"`);
    await qr.query(`DROP INDEX IF EXISTS public."ux_leads_id_tenant"`);
    await qr.query(`DROP INDEX IF EXISTS public."ux_contracts_id_tenant"`);

    await qr.query(`
      ALTER FUNCTION public.app_current_tenant_id()
        SET search_path = public, pg_catalog
    `);
    await qr.query(`
      ALTER FUNCTION public.private_get_tenant_id()
        SET search_path = public, pg_catalog
    `);
  }

  private async hardenTenantResolvers(qr: QueryRunner): Promise<void> {
    await qr.query(`
      CREATE OR REPLACE FUNCTION public.app_current_tenant_id()
      RETURNS uuid
      LANGUAGE plpgsql
      STABLE
      SECURITY DEFINER
      SET search_path = pg_catalog
      AS $fn$
      DECLARE
        v_tenant text;
        v_org text;
      BEGIN
        v_tenant := NULLIF(current_setting('app.current_tenant_id', true), '');
        IF v_tenant IS NOT NULL THEN
          RETURN v_tenant::uuid;
        END IF;

        v_org := public.app_jwt()->'app_metadata'->>'org_id';
        IF v_org IS NULL OR v_org = '' THEN
          RETURN NULL;
        END IF;

        RETURN (
          SELECT id
            FROM public.tenants
           WHERE org_id::text = v_org
             AND deleted_at IS NULL
           LIMIT 1
        );
      END;
      $fn$
    `);

    await qr.query(`
      CREATE OR REPLACE FUNCTION public.private_get_tenant_id()
      RETURNS uuid
      LANGUAGE sql
      STABLE
      SECURITY DEFINER
      SET search_path = pg_catalog
      AS $fn$
        SELECT public.app_current_tenant_id()
      $fn$
    `);

    await qr.query(`REVOKE ALL ON FUNCTION public.app_current_tenant_id() FROM PUBLIC`);
    await qr.query(`REVOKE ALL ON FUNCTION public.private_get_tenant_id() FROM PUBLIC`);
    await qr.query(`
      DO $do$
      DECLARE
        role_name text;
      BEGIN
        FOREACH role_name IN ARRAY ARRAY['authenticated', 'musicos_app', 'service_role']
        LOOP
          IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
            EXECUTE format(
              'GRANT EXECUTE ON FUNCTION public.app_current_tenant_id() TO %I',
              role_name
            );
            EXECUTE format(
              'GRANT EXECUTE ON FUNCTION public.private_get_tenant_id() TO %I',
              role_name
            );
          END IF;
        END LOOP;
      END
      $do$;
    `);
  }

  private async addTenantRelationshipConstraints(qr: QueryRunner): Promise<void> {
    await qr.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "ux_contacts_id_tenant"
        ON public."contacts" ("id", "tenant_id")
    `);
    await qr.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "ux_leads_id_tenant"
        ON public."leads" ("id", "tenant_id")
    `);
    await qr.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "ux_contracts_id_tenant"
        ON public."contracts" ("id", "tenant_id")
    `);

    for (const relation of [
      {
        table: 'contact_attachments',
        constraint: 'fk_contact_attachments_contact_tenant',
        columns: '"contact_id", "tenant_id"',
        parent: 'contacts',
        onDelete: 'CASCADE',
      },
      {
        table: 'contact_contracts',
        constraint: 'fk_contact_contracts_contact_tenant',
        columns: '"contact_id", "tenant_id"',
        parent: 'contacts',
        onDelete: 'CASCADE',
      },
      {
        table: 'contact_contracts',
        constraint: 'fk_contact_contracts_contract_tenant',
        columns: '"contract_id", "tenant_id"',
        parent: 'contracts',
        onDelete: 'NO ACTION',
      },
      {
        table: 'contact_timeline',
        constraint: 'fk_contact_timeline_contact_tenant',
        columns: '"contact_id", "tenant_id"',
        parent: 'contacts',
        onDelete: 'CASCADE',
      },
      {
        table: 'lead_uploads',
        constraint: 'fk_lead_uploads_lead_tenant',
        columns: '"lead_id", "tenant_id"',
        parent: 'leads',
        onDelete: 'CASCADE',
      },
    ] as const) {
      await qr.query(`
        DO $do$
        BEGIN
          IF NOT EXISTS (
            SELECT 1
              FROM pg_constraint
             WHERE conrelid = 'public.${relation.table}'::regclass
               AND conname = '${relation.constraint}'
          ) THEN
            ALTER TABLE public."${relation.table}"
              ADD CONSTRAINT "${relation.constraint}"
              FOREIGN KEY (${relation.columns})
              REFERENCES public."${relation.parent}" ("id", "tenant_id")
              ON DELETE ${relation.onDelete}
              NOT VALID;
          END IF;
        END
        $do$;
      `);
      await qr.query(`
        ALTER TABLE public."${relation.table}"
          VALIDATE CONSTRAINT "${relation.constraint}"
      `);
    }
  }
}

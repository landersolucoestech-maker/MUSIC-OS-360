import type { MigrationInterface, QueryRunner } from 'typeorm';

const TABLES = [
  'operational_tasks',
  'campaign_tasks',
  'campaign_assets',
  'ai_usage_logs',
] as const;

export class ReconcileOperationalSchema20260620000004
  implements MigrationInterface
{
  name = 'ReconcileOperationalSchema20260620000004';

  async up(qr: QueryRunner): Promise<void> {
    await qr.query(`
      CREATE TABLE IF NOT EXISTS public."operational_tasks" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" UUID NOT NULL,
        "title" VARCHAR(500) NOT NULL,
        "description" TEXT,
        "status" VARCHAR(50) NOT NULL DEFAULT 'pending',
        "priority" VARCHAR(50) NOT NULL DEFAULT 'medium',
        "type" VARCHAR(100),
        "contact_id" UUID,
        "company_id" UUID,
        "assigned_to" VARCHAR(255),
        "due_date" TIMESTAMPTZ,
        "completed_at" TIMESTAMPTZ,
        "created_by" VARCHAR(255),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await qr.query(`
      CREATE INDEX IF NOT EXISTS "idx_operational_tasks_tenant_status"
        ON public."operational_tasks" ("tenant_id", "status", "due_date")
    `);
    await qr.query(`
      CREATE INDEX IF NOT EXISTS "idx_operational_tasks_tenant_type"
        ON public."operational_tasks" ("tenant_id", "type")
    `);
    await qr.query(`
      CREATE INDEX IF NOT EXISTS "idx_operational_tasks_assignee"
        ON public."operational_tasks" ("tenant_id", "assigned_to")
    `);

    await qr.query(`
      CREATE TABLE IF NOT EXISTS public."campaign_tasks" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" UUID NOT NULL,
        "campaign_id" UUID NOT NULL REFERENCES public."campaigns" ("id") ON DELETE CASCADE,
        "title" VARCHAR(500) NOT NULL,
        "description" TEXT,
        "status" VARCHAR(50) NOT NULL DEFAULT 'pending',
        "priority" VARCHAR(50) NOT NULL DEFAULT 'medium',
        "assigned_to" VARCHAR(255),
        "due_date" TIMESTAMPTZ,
        "completed_at" TIMESTAMPTZ,
        "created_by" VARCHAR(255),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await qr.query(`
      CREATE INDEX IF NOT EXISTS "idx_campaign_tasks_campaign"
        ON public."campaign_tasks" ("tenant_id", "campaign_id")
    `);
    await qr.query(`
      CREATE INDEX IF NOT EXISTS "idx_campaign_tasks_due"
        ON public."campaign_tasks" ("tenant_id", "due_date")
    `);

    await qr.query(`
      CREATE TABLE IF NOT EXISTS public."campaign_assets" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" UUID NOT NULL,
        "campaign_id" UUID NOT NULL REFERENCES public."campaigns" ("id") ON DELETE CASCADE,
        "name" VARCHAR(500) NOT NULL,
        "asset_type" VARCHAR(100) NOT NULL,
        "file_url" TEXT NOT NULL,
        "file_size" BIGINT,
        "mime_type" VARCHAR(100),
        "description" TEXT,
        "metadata" JSONB NOT NULL DEFAULT '{}',
        "created_by" VARCHAR(255),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMPTZ
      )
    `);
    await qr.query(`
      CREATE INDEX IF NOT EXISTS "idx_campaign_assets_campaign"
        ON public."campaign_assets" ("tenant_id", "campaign_id")
    `);

    await qr.query(`
      CREATE TABLE IF NOT EXISTS public."ai_usage_logs" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" UUID NOT NULL,
        "job_id" UUID,
        "model" VARCHAR(255) NOT NULL,
        "feature" VARCHAR(100) NOT NULL,
        "tokens_input" INTEGER NOT NULL DEFAULT 0,
        "tokens_output" INTEGER NOT NULL DEFAULT 0,
        "cost_usd" DECIMAL(12,6) NOT NULL DEFAULT 0,
        "latency_ms" INTEGER,
        "outcome" VARCHAR(50) NOT NULL DEFAULT 'success',
        "user_id" VARCHAR(255),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await qr.query(`
      CREATE INDEX IF NOT EXISTS "idx_ai_usage_tenant"
        ON public."ai_usage_logs" ("tenant_id", "created_at")
    `);
    await qr.query(`
      CREATE INDEX IF NOT EXISTS "idx_ai_usage_model"
        ON public."ai_usage_logs" ("tenant_id", "model")
    `);
    await qr.query(`
      CREATE INDEX IF NOT EXISTS "idx_ai_usage_job"
        ON public."ai_usage_logs" ("job_id")
    `);

    await qr.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "ux_campaigns_id_tenant"
        ON public."campaigns" ("id", "tenant_id")
    `);
    for (const relation of ['campaign_tasks', 'campaign_assets'] as const) {
      const constraint = `fk_${relation}_campaign_tenant`;
      await qr.query(`
        DO $do$
        BEGIN
          IF NOT EXISTS (
            SELECT 1
              FROM pg_constraint
             WHERE conrelid = 'public.${relation}'::regclass
               AND conname = '${constraint}'
          ) THEN
            ALTER TABLE public."${relation}"
              ADD CONSTRAINT "${constraint}"
              FOREIGN KEY ("campaign_id", "tenant_id")
              REFERENCES public."campaigns" ("id", "tenant_id")
              ON DELETE CASCADE
              NOT VALID;
          END IF;
        END
        $do$;
      `);
      await qr.query(`
        ALTER TABLE public."${relation}" VALIDATE CONSTRAINT "${constraint}"
      `);
    }

    for (const table of TABLES) {
      await this.applyTenantSecurity(qr, table);
    }
  }

  async down(qr: QueryRunner): Promise<void> {
    for (const table of [...TABLES].reverse()) {
      await qr.query(`DROP TABLE IF EXISTS public."${table}" CASCADE`);
    }
    await qr.query(`DROP INDEX IF EXISTS public."ux_campaigns_id_tenant"`);
  }

  private async applyTenantSecurity(
    qr: QueryRunner,
    table: (typeof TABLES)[number],
  ): Promise<void> {
    await qr.query(`ALTER TABLE public."${table}" ENABLE ROW LEVEL SECURITY`);
    await qr.query(`ALTER TABLE public."${table}" FORCE ROW LEVEL SECURITY`);

    for (const operation of ['select', 'insert', 'update', 'delete'] as const) {
      await qr.query(
        `DROP POLICY IF EXISTS "${table}_tenant_${operation}" ON public."${table}"`,
      );
    }

    await qr.query(`
      DO $do$
      DECLARE
        has_authenticated boolean;
        has_musicos_app boolean;
        policy_roles text;
      BEGIN
        SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') INTO has_authenticated;
        SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'musicos_app') INTO has_musicos_app;

        -- A policy name is unique per table (not per role): when both
        -- roles exist at the same time, the policy is created ONCE with the
        -- combined role list, instead of two policies with the same name.
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
      END
      $do$;
    `);

    await qr.query(`REVOKE ALL PRIVILEGES ON TABLE public."${table}" FROM PUBLIC`);
    await qr.query(`
      DO $do$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
          EXECUTE 'REVOKE ALL PRIVILEGES ON TABLE public."${table}" FROM anon';
        END IF;
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
          EXECUTE 'REVOKE ALL PRIVILEGES ON TABLE public."${table}" FROM authenticated';
          EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."${table}" TO authenticated';
        END IF;
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'musicos_app') THEN
          EXECUTE 'REVOKE ALL PRIVILEGES ON TABLE public."${table}" FROM musicos_app';
          EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."${table}" TO musicos_app';
        END IF;
      END
      $do$;
    `);
  }
}

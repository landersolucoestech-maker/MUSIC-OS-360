import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * billing_plans — primary source of plans/prices (defined by the admin/database).
 * Stripe only receives the sync (product/price) via the backend; it is NOT the primary
 * source. Replaces the dependency on fixed STRIPE_PRICE_* in .env.
 *
 * Plans are GLOBAL (SaaS tiers), following the existing pattern (PLAN_FEATURES /
 * TenantPlan enum / global Admin Panel) — which is why there is no tenant_id.
 */
export class BillingPlans20260701000002 implements MigrationInterface {
  name = 'BillingPlans20260701000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "billing_plans" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "slug" varchar(60) NOT NULL UNIQUE,
        "name" varchar(120) NOT NULL,
        "description" text,
        "amount" integer NOT NULL,
        "currency" varchar(3) NOT NULL DEFAULT 'brl',
        "interval" varchar(10) NOT NULL DEFAULT 'month',
        "active" boolean NOT NULL DEFAULT true,
        "features" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "limits" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "stripe_product_id" varchar(255),
        "stripe_price_id" varchar(255),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "chk_billing_plans_amount" CHECK ("amount" > 0),
        CONSTRAINT "chk_billing_plans_currency_lower" CHECK ("currency" = lower("currency")),
        CONSTRAINT "chk_billing_plans_interval" CHECK ("interval" IN ('month','year'))
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_billing_plans_active" ON "billing_plans" ("active")`);

    // Seed of the 3 existing tiers (amounts in cents, BRL). stripe_* null until sync.
    // Amounts are placeholders editable by the admin.
    await queryRunner.query(`
      INSERT INTO "billing_plans" ("slug","name","description","amount","currency","interval","active","features","limits")
      VALUES
        ('starter','Starter','Plano inicial para pequenas operações',9900,'brl','month',true,
          '{"moduleArtists":true,"moduleCatalog":true,"moduleContracts":true,"moduleCrm":true}'::jsonb,
          '{"artists":5,"contracts":20,"storageGb":5,"users":3}'::jsonb),
        ('professional','Professional','Plano completo para operações em crescimento',29900,'brl','month',true,
          '{"moduleArtists":true,"moduleCatalog":true,"moduleContracts":true,"moduleCrm":true,"moduleMarketing":true,"moduleAccounting":true,"moduleMonitoring":true,"moduleRh":true}'::jsonb,
          '{"artists":50,"contracts":200,"storageGb":50,"users":15}'::jsonb),
        ('enterprise','Enterprise','Plano ilimitado com recursos avançados',99900,'brl','month',true,
          '{"moduleArtists":true,"moduleCatalog":true,"moduleContracts":true,"moduleCrm":true,"moduleMarketing":true,"moduleAccounting":true,"moduleMonitoring":true,"moduleRh":true,"aiFeatures":true,"analyticsAdvanced":true}'::jsonb,
          '{"artists":null,"contracts":null,"storageGb":null,"users":null}'::jsonb)
      ON CONFLICT ("slug") DO NOTHING
    `);

    // RLS: GLOBAL config (no tenant isolation). Enables RLS to keep the
    // fail-closed posture consistent with billing_settings, with a permissive policy —
    // write authorization is done in the RBAC layer (admin endpoints).
    await queryRunner.query(`ALTER TABLE "billing_plans" ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='billing_plans' AND policyname='billing_plans_global_access') THEN
          CREATE POLICY "billing_plans_global_access" ON "billing_plans" FOR ALL USING (true) WITH CHECK (true);
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP POLICY IF EXISTS "billing_plans_global_access" ON "billing_plans"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "billing_plans"`);
  }
}

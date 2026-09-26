import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * RLS hardening of the system-managed billing tables.
 *
 * PROBLEM (evidence): billing.service / billing-enforcement.service use
 * DATA_SOURCE, which in production (DATABASE_SESSION_CONTEXT_ENABLED=true) connects
 * as `musicos_app` — a LOGIN NOBYPASSRLS role, member of `authenticated`.
 * The tenant_billing_state / payment_events / billing_settings tables had
 * RLS ENABLE but NO policy → for a non-owner role that is DENY-ALL
 * (the webhook does not write payment_events/tenant_billing_state; enforcement breaks).
 *
 * FIX: FORCE ROW LEVEL SECURITY (fail-closed, consistent with the other
 * tables) + minimal policies using the portable helpers app_current_tenant_id()
 * and app_is_super_admin() (migration 20260612000001).
 *
 * Access model:
 *  - SYSTEM path (@Public webhook / schedulers): no app.current_tenant_id
 *    → app_current_tenant_id() = NULL → access granted (needed for webhook
 *    idempotency and enforcement). Tenant routes ALWAYS have the context set, so they
 *    never fall into this branch.
 *  - TENANT session: sees/changes only its own row (tenant_id).
 *  - super_admin: full access (admin suspension/reactivation endpoints).
 */
export class BillingRlsHardening20260701000003 implements MigrationInterface {
  name = 'BillingRlsHardening20260701000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── tenant_billing_state (tenant-scoped) ────────────────────────────────
    await queryRunner.query(`ALTER TABLE "tenant_billing_state" ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE "tenant_billing_state" FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`DROP POLICY IF EXISTS "super_admin_full_access" ON "tenant_billing_state"`);
    await queryRunner.query(`
      CREATE POLICY "super_admin_full_access" ON "tenant_billing_state"
        FOR ALL TO authenticated
        USING (app_is_super_admin()) WITH CHECK (app_is_super_admin())
    `);
    await queryRunner.query(`DROP POLICY IF EXISTS "tenant_billing_state_access" ON "tenant_billing_state"`);
    await queryRunner.query(`
      CREATE POLICY "tenant_billing_state_access" ON "tenant_billing_state"
        FOR ALL TO authenticated
        USING (app_current_tenant_id() IS NULL OR tenant_id = app_current_tenant_id())
        WITH CHECK (app_current_tenant_id() IS NULL OR tenant_id = app_current_tenant_id())
    `);

    // ── payment_events (auditoria de sistema; tenant_id nullable) ────────────
    await queryRunner.query(`ALTER TABLE "payment_events" ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE "payment_events" FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`DROP POLICY IF EXISTS "super_admin_full_access" ON "payment_events"`);
    await queryRunner.query(`
      CREATE POLICY "super_admin_full_access" ON "payment_events"
        FOR ALL TO authenticated
        USING (app_is_super_admin()) WITH CHECK (app_is_super_admin())
    `);
    await queryRunner.query(`DROP POLICY IF EXISTS "payment_events_access" ON "payment_events"`);
    await queryRunner.query(`
      CREATE POLICY "payment_events_access" ON "payment_events"
        FOR ALL TO authenticated
        USING (app_current_tenant_id() IS NULL OR tenant_id IS NULL OR tenant_id = app_current_tenant_id())
        WITH CHECK (app_current_tenant_id() IS NULL OR tenant_id IS NULL OR tenant_id = app_current_tenant_id())
    `);

    // ── billing_settings (config global; leitura p/ app, escrita p/ super_admin) ─
    await queryRunner.query(`ALTER TABLE "billing_settings" ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE "billing_settings" FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`DROP POLICY IF EXISTS "billing_settings_read" ON "billing_settings"`);
    await queryRunner.query(`
      CREATE POLICY "billing_settings_read" ON "billing_settings"
        FOR SELECT TO authenticated USING (true)
    `);
    await queryRunner.query(`DROP POLICY IF EXISTS "billing_settings_admin" ON "billing_settings"`);
    await queryRunner.query(`
      CREATE POLICY "billing_settings_admin" ON "billing_settings"
        FOR ALL TO authenticated
        USING (app_is_super_admin()) WITH CHECK (app_is_super_admin())
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP POLICY IF EXISTS "billing_settings_admin" ON "billing_settings"`);
    await queryRunner.query(`DROP POLICY IF EXISTS "billing_settings_read" ON "billing_settings"`);
    await queryRunner.query(`ALTER TABLE "billing_settings" NO FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`DROP POLICY IF EXISTS "payment_events_access" ON "payment_events"`);
    await queryRunner.query(`DROP POLICY IF EXISTS "super_admin_full_access" ON "payment_events"`);
    await queryRunner.query(`ALTER TABLE "payment_events" NO FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`DROP POLICY IF EXISTS "tenant_billing_state_access" ON "tenant_billing_state"`);
    await queryRunner.query(`DROP POLICY IF EXISTS "super_admin_full_access" ON "tenant_billing_state"`);
    await queryRunner.query(`ALTER TABLE "tenant_billing_state" NO FORCE ROW LEVEL SECURITY`);
  }
}

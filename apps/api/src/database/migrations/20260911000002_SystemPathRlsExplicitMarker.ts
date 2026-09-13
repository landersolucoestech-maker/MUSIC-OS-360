import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * find-03176eef (Wave 4, fixed in Wave 5): webhook_events / payment_events /
 * tenant_billing_state used `USING (app_current_tenant_id() IS NULL OR
 * tenant_id = app_current_tenant_id())` as their "system path" escape hatch
 * (20260701000003_BillingRlsHardening, 20260817000002_WebhookEventsRlsSystemPath).
 * The condition was "no tenant session set", not "this is genuinely the
 * webhook/system path" — ANY authenticated-role connection with no tenant
 * context set (including a BullMQ worker that forgot to call
 * runInTenantContext, or simply DATABASE_SESSION_CONTEXT_ENABLED being off)
 * got unrestricted cross-tenant access to these three tables.
 *
 * FIX: a new portable helper `app_is_system_context()` requires an explicit,
 * deliberate marker (`app.current_role = 'system'`) set only by the code
 * paths that are genuinely system-initiated (Stripe webhook handling with no
 * resolvable tenant yet). Absence of context is no longer sufficient — it is
 * now fail-closed-deny, matching every other tenant table. The paired
 * application change (billing.service.ts / billing-enforcement.service.ts)
 * wires `DatabaseContextService.runInTenantContext({tenantId, role: tenantId
 * ? null : 'system'})` around the webhook write path so it explicitly
 * declares system-path intent instead of relying on absent context.
 *
 * Non-destructive: no table or row is touched, only a new function and 3
 * policy expressions are swapped (mirrors 20260612000001_PortableRlsTenantContext's
 * reversibility model).
 */
export class SystemPathRlsExplicitMarker20260911000002 implements MigrationInterface {
  name = 'SystemPathRlsExplicitMarker20260911000002';

  private readonly TABLES = ['webhook_events', 'payment_events', 'tenant_billing_state'];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION app_is_system_context()
      RETURNS boolean
      LANGUAGE sql
      STABLE
      AS $fn$
        SELECT NULLIF(current_setting('app.current_role', true), '') = 'system'
      $fn$
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
          GRANT EXECUTE ON FUNCTION app_is_system_context() TO authenticated;
        END IF;
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
          GRANT EXECUTE ON FUNCTION app_is_system_context() TO service_role;
        END IF;
      END $$
    `);

    await queryRunner.query(`
      DROP POLICY IF EXISTS "webhook_events_access" ON "webhook_events"
    `);
    await queryRunner.query(`
      CREATE POLICY "webhook_events_access" ON "webhook_events"
        FOR ALL TO authenticated
        USING (app_is_system_context() OR tenant_id IS NULL OR tenant_id = app_current_tenant_id())
        WITH CHECK (app_is_system_context() OR tenant_id IS NULL OR tenant_id = app_current_tenant_id())
    `);

    await queryRunner.query(`
      DROP POLICY IF EXISTS "tenant_billing_state_access" ON "tenant_billing_state"
    `);
    await queryRunner.query(`
      CREATE POLICY "tenant_billing_state_access" ON "tenant_billing_state"
        FOR ALL TO authenticated
        USING (app_is_system_context() OR tenant_id = app_current_tenant_id())
        WITH CHECK (app_is_system_context() OR tenant_id = app_current_tenant_id())
    `);

    await queryRunner.query(`
      DROP POLICY IF EXISTS "payment_events_access" ON "payment_events"
    `);
    await queryRunner.query(`
      CREATE POLICY "payment_events_access" ON "payment_events"
        FOR ALL TO authenticated
        USING (app_is_system_context() OR tenant_id IS NULL OR tenant_id = app_current_tenant_id())
        WITH CHECK (app_is_system_context() OR tenant_id IS NULL OR tenant_id = app_current_tenant_id())
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP POLICY IF EXISTS "payment_events_access" ON "payment_events"`);
    await queryRunner.query(`
      CREATE POLICY "payment_events_access" ON "payment_events"
        FOR ALL TO authenticated
        USING (app_current_tenant_id() IS NULL OR tenant_id IS NULL OR tenant_id = app_current_tenant_id())
        WITH CHECK (app_current_tenant_id() IS NULL OR tenant_id IS NULL OR tenant_id = app_current_tenant_id())
    `);

    await queryRunner.query(`DROP POLICY IF EXISTS "tenant_billing_state_access" ON "tenant_billing_state"`);
    await queryRunner.query(`
      CREATE POLICY "tenant_billing_state_access" ON "tenant_billing_state"
        FOR ALL TO authenticated
        USING (app_current_tenant_id() IS NULL OR tenant_id = app_current_tenant_id())
        WITH CHECK (app_current_tenant_id() IS NULL OR tenant_id = app_current_tenant_id())
    `);

    await queryRunner.query(`DROP POLICY IF EXISTS "webhook_events_access" ON "webhook_events"`);
    await queryRunner.query(`
      CREATE POLICY "webhook_events_access" ON "webhook_events"
        FOR ALL TO authenticated
        USING (app_current_tenant_id() IS NULL OR tenant_id IS NULL OR tenant_id = app_current_tenant_id())
        WITH CHECK (app_current_tenant_id() IS NULL OR tenant_id IS NULL OR tenant_id = app_current_tenant_id())
    `);

    await queryRunner.query(`DROP FUNCTION IF EXISTS app_is_system_context()`);
  }
}

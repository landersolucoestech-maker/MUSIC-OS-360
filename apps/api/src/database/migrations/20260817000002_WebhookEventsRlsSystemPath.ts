import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fixes the RLS of `webhook_events` to the same system model already applied
 * to `payment_events`/`tenant_billing_state` in 20260701000003_BillingRlsHardening.
 *
 * PROBLEM (reproduced in real staging): `webhook_events` still uses the
 * generic `tenant_isolation` policy (20260520000020_RLSPolicies), which requires
 * `tenant_id = private_get_tenant_id()`. The Stripe webhook is `@Public()` and
 * never sets app.current_tenant_id (there is no tenant session on that path) —
 * so `tenant_id = NULL` evaluates to NULL, the policy denies the INSERT in
 * BillingService.recordLegacyWebhook(), and the call breaks with a 500 even with a
 * valid Stripe signature. Autentique/external-data do not suffer the same
 * problem because they bootstrap a tenant context before writing; the Stripe
 * webhook does not do that and should not need to — the system model
 * (payment_events) already solves this correctly.
 *
 * FIX: the same "system path" policy payment_events already has —
 * app_current_tenant_id() IS NULL allows it (webhook/scheduler without a session),
 * otherwise it requires tenant_id = app_current_tenant_id() (normal tenant session).
 */
export class WebhookEventsRlsSystemPath20260817000002 implements MigrationInterface {
  name = 'WebhookEventsRlsSystemPath20260817000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "webhook_events" ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE "webhook_events" FORCE ROW LEVEL SECURITY`);

    await queryRunner.query(`DROP POLICY IF EXISTS "tenant_isolation" ON "webhook_events"`);
    await queryRunner.query(`DROP POLICY IF EXISTS "super_admin_full_access" ON "webhook_events"`);
    await queryRunner.query(`
      CREATE POLICY "super_admin_full_access" ON "webhook_events"
        FOR ALL TO authenticated
        USING (app_is_super_admin()) WITH CHECK (app_is_super_admin())
    `);
    await queryRunner.query(`DROP POLICY IF EXISTS "webhook_events_access" ON "webhook_events"`);
    await queryRunner.query(`
      CREATE POLICY "webhook_events_access" ON "webhook_events"
        FOR ALL TO authenticated
        USING (app_current_tenant_id() IS NULL OR tenant_id IS NULL OR tenant_id = app_current_tenant_id())
        WITH CHECK (app_current_tenant_id() IS NULL OR tenant_id IS NULL OR tenant_id = app_current_tenant_id())
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP POLICY IF EXISTS "webhook_events_access" ON "webhook_events"`);
    await queryRunner.query(`DROP POLICY IF EXISTS "super_admin_full_access" ON "webhook_events"`);
    await queryRunner.query(`
      CREATE POLICY "super_admin_full_access" ON "webhook_events"
        FOR ALL TO authenticated
        USING ((auth.jwt()->'app_metadata'->>'role')::text = 'super_admin')
        WITH CHECK ((auth.jwt()->'app_metadata'->>'role')::text = 'super_admin')
    `);
    await queryRunner.query(`
      CREATE POLICY "tenant_isolation" ON "webhook_events"
        FOR ALL TO authenticated
        USING (tenant_id = private_get_tenant_id())
        WITH CHECK (tenant_id = private_get_tenant_id())
    `);
  }
}

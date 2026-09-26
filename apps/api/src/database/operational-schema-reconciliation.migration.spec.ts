import { ReconcileOperationalSchema20260620000004 } from './migrations/20260620000004_ReconcileOperationalSchema';

describe('ReconcileOperationalSchema20260620000004', () => {
  it('creates active operational tables with forced tenant RLS', async () => {
    const qr = { query: jest.fn(async (_sql: string) => undefined) };
    await new ReconcileOperationalSchema20260620000004().up(qr as never);
    const sql = qr.query.mock.calls.map(([statement]) => statement).join('\n');

    const TABLES = [
      'operational_tasks',
      'campaign_tasks',
      'campaign_assets',
      'ai_usage_logs',
    ];

    for (const table of TABLES) {
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS public."${table}"`);
      expect(sql).toContain(
        `ALTER TABLE public."${table}" ENABLE ROW LEVEL SECURITY`,
      );
      expect(sql).toContain(
        `ALTER TABLE public."${table}" FORCE ROW LEVEL SECURITY`,
      );
      // Policies are created with the role list resolved at runtime
      // (policy_roles) — a fail-closed invariant verified below — not with
      // a fixed role name.
      expect(sql).toContain(
        `EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO %s USING ("tenant_id" = (SELECT public.app_current_tenant_id()))', '${table}_tenant_select', '${table}', policy_roles)`,
      );
      expect(sql).toContain(
        `EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO %s WITH CHECK ("tenant_id" = (SELECT public.app_current_tenant_id()))', '${table}_tenant_insert', '${table}', policy_roles)`,
      );
      expect(sql).toContain(
        `EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO %s USING ("tenant_id" = (SELECT public.app_current_tenant_id())) WITH CHECK ("tenant_id" = (SELECT public.app_current_tenant_id()))', '${table}_tenant_update', '${table}', policy_roles)`,
      );
      expect(sql).toContain(
        `EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO %s USING ("tenant_id" = (SELECT public.app_current_tenant_id()))', '${table}_tenant_delete', '${table}', policy_roles)`,
      );
    }
    expect(sql.match(/CREATE POLICY %I ON public\.%I/g)).toHaveLength(TABLES.length * 4);
    expect(sql).not.toMatch(/USING\s*\(\s*true\s*\)/i);
    expect(sql).toContain('fk_campaign_tasks_campaign_tenant');
    expect(sql).toContain('fk_campaign_assets_campaign_tenant');

    // Fail-closed invariant: policy_roles only includes roles that really
    // exist in the database — never hardcoded, so it does not fail open on a
    // new/local database without the 'authenticated'/'musicos_app' roles.
    expect(sql).toContain("SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') INTO has_authenticated");
    expect(sql).toContain("SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'musicos_app') INTO has_musicos_app");
    expect(sql).toContain('IF policy_roles IS NOT NULL THEN');
  });
});

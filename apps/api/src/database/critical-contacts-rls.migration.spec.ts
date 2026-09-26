import { HardenContactsLeadUploadsRls20260620000002 } from './migrations/20260620000002_HardenContactsLeadUploadsRls';

const TABLES = [
  'contacts',
  'contact_attachments',
  'contact_contracts',
  'contact_timeline',
  'lead_uploads',
];

describe('HardenContactsLeadUploadsRls20260620000002', () => {
  function queryRunner() {
    return { query: jest.fn(async (_sql: string) => undefined) };
  }

  it('enables and forces RLS with minimal per-operation policies', async () => {
    const qr = queryRunner();
    await new HardenContactsLeadUploadsRls20260620000002().up(qr as never);
    const sql = qr.query.mock.calls.map(([statement]) => statement).join('\n');

    for (const table of TABLES) {
      expect(sql).toContain(
        `ALTER TABLE public."${table}" ENABLE ROW LEVEL SECURITY`,
      );
      expect(sql).toContain(
        `ALTER TABLE public."${table}" FORCE ROW LEVEL SECURITY`,
      );
      // Policies are created with the role list resolved at runtime
      // (policy_roles), not with a fixed role name — see the
      // "fail-closed on a missing role" invariant below. The text of the EXECUTE format(...)
      // itself stays literal and is verified in full.
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

    // 4 policies (select/insert/update/delete) per table — the number follows from the
    // table list, not from a magic value independent of it.
    expect(sql.match(/CREATE POLICY %I ON public\.%I/g)).toHaveLength(TABLES.length * 4);
    expect(sql).toContain(
      '"tenant_id" = (SELECT public.app_current_tenant_id())',
    );
    expect(sql).not.toMatch(/USING\s*\(\s*true\s*\)|WITH CHECK\s*\(\s*true\s*\)/i);

    // Fail-closed invariant: policy_roles only includes roles that really
    // exist in the database (checked dynamically), and the whole policy is only
    // created when at least one role qualifies — it never falls back to a hardcoded
    // role name that might not exist in a new/local database.
    expect(sql).toContain(
      "SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') INTO has_authenticated",
    );
    expect(sql).toContain(
      "SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'musicos_app') INTO has_musicos_app",
    );
    expect(sql).toContain("policy_roles := concat_ws(', ',");
    expect(sql).toContain("CASE WHEN has_authenticated THEN 'authenticated' END");
    expect(sql).toContain("CASE WHEN has_musicos_app THEN 'musicos_app' END");
    expect(sql).toContain('IF policy_roles IS NOT NULL THEN');
  });

  it('restricts ACLs and hardens the SECURITY DEFINER resolvers', async () => {
    const qr = queryRunner();
    await new HardenContactsLeadUploadsRls20260620000002().up(qr as never);
    const sql = qr.query.mock.calls.map(([statement]) => statement).join('\n');

    expect(sql).toContain(
      'REVOKE ALL ON FUNCTION public.app_current_tenant_id() FROM PUBLIC',
    );
    expect(sql).toContain(
      'REVOKE ALL ON FUNCTION public.private_get_tenant_id() FROM PUBLIC',
    );
    expect(sql.match(/SET search_path = pg_catalog/g)).toHaveLength(2);
    expect(sql).toContain('public.app_jwt()');
    expect(sql).toContain('SELECT public.app_current_tenant_id()');

    for (const table of TABLES) {
      expect(sql).toContain(
        `REVOKE ALL PRIVILEGES ON TABLE public.%I FROM PUBLIC', '${table}'`,
      );
      expect(sql).toContain(
        `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated', '${table}'`,
      );
    }
  });

  it('prevents parent/child links across different tenants', async () => {
    const qr = queryRunner();
    await new HardenContactsLeadUploadsRls20260620000002().up(qr as never);
    const sql = qr.query.mock.calls.map(([statement]) => statement).join('\n');

    expect(sql).toContain('fk_contact_attachments_contact_tenant');
    expect(sql).toContain('fk_contact_contracts_contact_tenant');
    expect(sql).toContain('fk_contact_contracts_contract_tenant');
    expect(sql).toContain('fk_contact_timeline_contact_tenant');
    expect(sql).toContain('fk_lead_uploads_lead_tenant');
    expect(sql.match(/VALIDATE CONSTRAINT "fk_/g)).toHaveLength(5);
  });

  it('revokes direct exposure of the RBAC decision partitions', async () => {
    const qr = queryRunner();
    await new HardenContactsLeadUploadsRls20260620000002().up(qr as never);
    const sql = qr.query.mock.calls.map(([statement]) => statement).join('\n');

    for (const relation of [
      'rbac_decision_logs',
      'rbac_decision_logs_2026_05',
      'rbac_decision_logs_2026_06',
      'rbac_decision_logs_2026_07',
      'rbac_decision_logs_2026_08',
      'rbac_decision_logs_default',
    ]) {
      expect(sql).toContain(`to_regclass('public.${relation}')`);
      expect(sql).toContain(
        `REVOKE ALL PRIVILEGES ON TABLE public."${relation}" FROM authenticated`,
      );
    }
  });

  it('remove policies, FORCE RLS e constraints no rollback', async () => {
    const qr = queryRunner();
    await new HardenContactsLeadUploadsRls20260620000002().down(qr as never);
    const sql = qr.query.mock.calls.map(([statement]) => statement).join('\n');

    for (const table of TABLES) {
      expect(sql).toContain(
        `DROP POLICY IF EXISTS "${table}_tenant_select" ON public."${table}"`,
      );
      expect(sql).toContain(
        `ALTER TABLE public."${table}" NO FORCE ROW LEVEL SECURITY`,
      );
      expect(sql).toContain(
        `ALTER TABLE public."${table}" DISABLE ROW LEVEL SECURITY`,
      );
    }
    expect(sql).toContain(
      'DROP CONSTRAINT IF EXISTS "fk_lead_uploads_lead_tenant"',
    );
  });
});

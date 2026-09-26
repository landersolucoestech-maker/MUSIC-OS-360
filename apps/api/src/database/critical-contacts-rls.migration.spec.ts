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
      // Policies são criadas com a lista de roles resolvida em runtime
      // (policy_roles), não com um nome de role fixo — ver invariante de
      // "fail-closed por role ausente" abaixo. O texto do EXECUTE format(...)
      // em si permanece literal e é verificado por completo.
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

    // 4 policies (select/insert/update/delete) por tabela — número decorre da
    // lista de tabelas, não de um valor mágico independente dela.
    expect(sql.match(/CREATE POLICY %I ON public\.%I/g)).toHaveLength(TABLES.length * 4);
    expect(sql).toContain(
      '"tenant_id" = (SELECT public.app_current_tenant_id())',
    );
    expect(sql).not.toMatch(/USING\s*\(\s*true\s*\)|WITH CHECK\s*\(\s*true\s*\)/i);

    // Invariante fail-closed: policy_roles só inclui roles que realmente
    // existem no banco (checado dinamicamente), e a policy inteira só é
    // criada quando pelo menos um role qualifica — nunca cai para um nome de
    // role hardcoded que poderia não existir num banco novo/local.
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

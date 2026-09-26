import { HardenSupabaseDataApiSurface20260620000006 } from './migrations/20260620000006_HardenSupabaseDataApiSurface';

describe('HardenSupabaseDataApiSurface20260620000006', () => {
  it('removes anonymous grants and protects artist platform profiles by tenant', async () => {
    const qr = { query: jest.fn(async (_sql: string) => undefined) };

    await new HardenSupabaseDataApiSurface20260620000006().up(qr as never);
    const sql = qr.query.mock.calls.map(([statement]) => statement).join('\n');

    expect(sql).toContain('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon');
    expect(sql).toContain('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon');
    expect(sql).toContain(
      'ALTER TABLE public.artist_platform_profiles FORCE ROW LEVEL SECURITY',
    );
    expect(sql).toContain('artist_platform_profiles_select_tenant');
    expect(sql).toContain('artist_platform_profiles_insert_tenant');
    expect(sql).toContain('artist_platform_profiles_update_tenant');
    expect(sql).toContain('artist_platform_profiles_delete_tenant');
    expect(sql).toContain(
      'tenant_id = (SELECT public.private_get_tenant_id())',
    );
    expect(sql).toContain(
      'REVOKE ALL ON FUNCTION public.private_get_tenant_id() FROM PUBLIC, anon',
    );

    // The migration HAS one legitimate policy with USING (true): migrator_admin_all,
    // on public.musicos360_migrations, scoped exclusively to the
    // musicos_migrator role (TypeORM's own bookkeeping — without it, FORCE RLS
    // would block the next migration from registering itself). A generic
    // "not.toMatch" for USING(true) would give a false negative here; the real
    // security invariant is that USING(true) NEVER appears associated with any role
    // that serves application traffic (authenticated/anon/musicos_app/
    // service_role/PUBLIC) — only with the migrator's administrative role.
    // Extracts each whole CREATE POLICY statement (up to the ';' that closes it) —
    // not "up to the next CREATE POLICY", which would leak unrelated
    // statements (e.g. the GRANT EXECUTE ... TO authenticated of the resolvers'
    // hardening block, which are unrelated to this policy).
    const trueUsingBlocks = (sql.match(/CREATE POLICY[\s\S]*?;/g) ?? [])
      .filter((block) => /USING\s*\(\s*true\s*\)/i.test(block));

    expect(trueUsingBlocks).toHaveLength(1);
    expect(trueUsingBlocks[0]).toContain('CREATE POLICY migrator_admin_all');
    expect(trueUsingBlocks[0]).toContain('FOR ALL TO musicos_migrator');
    for (const applicationRole of ['authenticated', 'anon', 'musicos_app', 'service_role', 'PUBLIC']) {
      expect(trueUsingBlocks[0]).not.toContain(`TO ${applicationRole}`);
    }
  });
});

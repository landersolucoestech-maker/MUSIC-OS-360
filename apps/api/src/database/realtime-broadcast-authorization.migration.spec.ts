import { RealtimeBroadcastAuthorization20260801000001 } from './migrations/20260801000001_RealtimeBroadcastAuthorization';

describe('RealtimeBroadcastAuthorization20260801000001', () => {
  function queryRunner() {
    return { query: jest.fn(async (_sql: string) => undefined) };
  }

  it('enables RLS on realtime.messages and creates per-topic read policies', async () => {
    const qr = queryRunner();
    await new RealtimeBroadcastAuthorization20260801000001().up(qr as never);
    const sql = qr.query.mock.calls.map(([statement]) => statement).join('\n');

    expect(sql).toContain('ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY');

    // Tenant broadcast: topic must match 'tenant:' + JWT app_metadata.org_id —
    // same claim path as every other RLS policy in this project.
    expect(sql).toContain('CREATE POLICY "tenant_can_receive_broadcast" ON realtime.messages');
    expect(sql).toContain("realtime.topic() = 'tenant:' || (auth.jwt()->'app_metadata'->>'org_id')");

    // Individual notifications: topic must match 'user:' + JWT sub.
    expect(sql).toContain('CREATE POLICY "user_can_receive_own_broadcast" ON realtime.messages');
    expect(sql).toContain("realtime.topic() = 'user:' || (auth.jwt()->>'sub')");

    // Both policies restrict to broadcast messages only (not presence), and
    // to SELECT only — no INSERT policy exists, so only service_role
    // (which bypasses RLS) can ever publish; no client can forge an event.
    expect(sql.match(/extension = 'broadcast'/g)).toHaveLength(2);
    expect(sql).not.toContain('FOR INSERT');
    expect(sql).not.toMatch(/USING\s*\(\s*true\s*\)/i);
  });

  it('down() remove as policies e desabilita RLS', async () => {
    const qr = queryRunner();
    await new RealtimeBroadcastAuthorization20260801000001().down(qr as never);
    const sql = qr.query.mock.calls.map(([statement]) => statement).join('\n');

    expect(sql).toContain('DROP POLICY IF EXISTS "tenant_can_receive_broadcast" ON realtime.messages');
    expect(sql).toContain('DROP POLICY IF EXISTS "user_can_receive_own_broadcast" ON realtime.messages');
    expect(sql).toContain('ALTER TABLE realtime.messages DISABLE ROW LEVEL SECURITY');
  });
});

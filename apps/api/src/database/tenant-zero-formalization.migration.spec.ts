import { TenantZeroFormalization20260801000002 } from './migrations/20260801000002_TenantZeroFormalization';

describe('TenantZeroFormalization20260801000002', () => {
  function queryRunner() {
    return { query: jest.fn(async (_sql: string) => undefined) };
  }

  it('adiciona is_system_tenant a organizations e tenants de forma idempotente', async () => {
    const qr = queryRunner();
    await new TenantZeroFormalization20260801000002().up(qr as never);
    const sql = qr.query.mock.calls.map(([statement]) => statement).join('\n');

    expect(sql).toContain('ALTER TABLE organizations ADD COLUMN IF NOT EXISTS is_system_tenant boolean NOT NULL DEFAULT false');
    expect(sql).toContain('ALTER TABLE tenants ADD COLUMN IF NOT EXISTS is_system_tenant boolean NOT NULL DEFAULT false');
  });

  it('creates partial unique indexes that prevent more than one tenant-zero per table', async () => {
    const qr = queryRunner();
    await new TenantZeroFormalization20260801000002().up(qr as never);
    const sql = qr.query.mock.calls.map(([statement]) => statement).join('\n');

    expect(sql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS organizations_single_system_tenant');
    expect(sql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS tenants_single_system_tenant');
    // The real constraint is in the partial WHERE — without it, the index would limit nothing.
    expect(sql.match(/WHERE is_system_tenant = true/g)).toHaveLength(2);
  });

  it('the default is false — no existing tenant is promoted by the migration', async () => {
    const qr = queryRunner();
    await new TenantZeroFormalization20260801000002().up(qr as never);
    const sql = qr.query.mock.calls.map(([statement]) => statement).join('\n');

    expect(sql).not.toMatch(/UPDATE\s+(organizations|tenants)/i);
    expect(sql).toContain('DEFAULT false');
  });

  it('down() drops the indexes and column without deleting any tenant', async () => {
    const qr = queryRunner();
    await new TenantZeroFormalization20260801000002().down(qr as never);
    const sql = qr.query.mock.calls.map(([statement]) => statement).join('\n');

    expect(sql).toContain('DROP INDEX IF EXISTS tenants_single_system_tenant');
    expect(sql).toContain('DROP INDEX IF EXISTS organizations_single_system_tenant');
    expect(sql).toContain('ALTER TABLE tenants DROP COLUMN IF EXISTS is_system_tenant');
    expect(sql).toContain('ALTER TABLE organizations DROP COLUMN IF EXISTS is_system_tenant');
    expect(sql).not.toMatch(/DELETE FROM|DROP TABLE/i);
  });
});

import 'reflect-metadata';
import { AuditLogService } from './audit-log.service';

/**
 * REM-01 (Remaining Product Completion Backlog): admin-audit.service.ts
 * (Admin SaaS panel) was calling the tenant-scoped list() — a super_admin
 * only ever saw their own single tenant's audit trail. listAdmin() is the
 * real cross-tenant view: never filters by tenant_id.
 */
function makeService() {
  const ds = {
    query: jest.fn().mockResolvedValue([]),
    getRepository: jest.fn().mockReturnValue({}),
  };
  const svc = new AuditLogService(ds as never);
  return { svc, ds };
}

describe('AuditLogService.listAdmin', () => {
  it('never filters by tenant_id — only a real join with tenants for tenant_name', async () => {
    const { svc, ds } = makeService();
    await svc.listAdmin({});

    const [sql] = ds.query.mock.calls[0] as [string, unknown[]];
    expect(sql).not.toMatch(/tenant_id\s*=\s*\$/);
    expect(sql).toMatch(/JOIN tenants tn ON tn\.id = a\.tenant_id/);
    expect(sql).toMatch(/tn\.name AS tenant_name/);
  });

  it('applies action/entity filters as parameters and respects the limit ceiling', async () => {
    const { svc, ds } = makeService();
    await svc.listAdmin({ action: 'contract.updated', entity: 'contract', limit: 999 });

    const [sql, params] = ds.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/a\.action ILIKE \$1/);
    expect(sql).toMatch(/a\.entity = \$2/);
    expect(params).toEqual(['%contract.updated%', 'contract', 500]);
  });
});

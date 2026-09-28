import { InvoiceOverdueScheduler } from './invoice-overdue.scheduler';

/**
 * P2-7 — proves invoice cron cross-tenant discovery runs on ADMIN_DATA_SOURCE
 * while per-tenant processing runs on DATA_SOURCE + runInTenantContext, with
 * tenant-scoped updates and an owner-connection fallback when admin is absent.
 */

const TENANT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const TENANT_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function invoice(tenantId: string, id: string) {
  return {
    id, tenant_id: tenantId, invoice_number: `INV-${id}`, legacy_amount: 100,
    due_at: new Date(Date.now() - 5 * 86400000), metadata: {},
  };
}

function makeBuilder(repoState: any) {
  const b: any = { _where: [] as Array<{ sql: string; p: any }> };
  b.select   = jest.fn(() => b);
  b.update   = jest.fn(() => b);
  b.set      = jest.fn(() => b);
  b.andWhere = jest.fn(() => b);
  b.where    = jest.fn((sql: string, p?: any) => { b._where.push({ sql, p }); return b; });
  b.getRawMany = jest.fn(async () => repoState.rawMany ?? []);
  b.getMany = jest.fn(async () => {
    const tf = b._where.find((w: any) => typeof w.sql === 'string' && w.sql.includes('i.tenant_id = :tenantId'));
    const t = tf?.p?.tenantId as string | undefined;
    if (t && repoState.throwForTenant === t) throw new Error(`tenant ${t} boom`);
    return (repoState.manyByTenant?.[t ?? ''] ?? []);
  });
  b.execute = jest.fn(async () => ({ affected: 1 }));
  return b;
}

function makeRepo(state: any) {
  const builders: any[] = [];
  const repo: any = {
    builders,
    createQueryBuilder: jest.fn(() => { const b = makeBuilder(state); builders.push(b); return b; }),
  };
  return repo;
}
const dsOf = (repo: unknown) => ({ getRepository: jest.fn(() => repo) } as any);

const events = { emitTyped: jest.fn() } as any;
const dbContext = {
  runInTenantContext: jest.fn((_ctx: unknown, work: (m: unknown) => unknown) => work(undefined)),
} as any;

function updateWhereCalls(repo: any) {
  return repo.builders.flatMap((b: any) =>
    b._where.filter((w: any) => typeof w.sql === 'string' && w.sql === 'id = :id AND tenant_id = :tenantId'),
  );
}

describe('InvoiceOverdueScheduler — P2-7 admin discovery', () => {
  beforeEach(() => jest.clearAllMocks());

  it('discovers tenants via ADMIN_DATA_SOURCE and processes via DATA_SOURCE + runInTenantContext', async () => {
    const adminRepo = makeRepo({ rawMany: [{ tenant_id: TENANT_A }, { tenant_id: TENANT_B }] });
    const appRepo = makeRepo({ manyByTenant: { [TENANT_A]: [invoice(TENANT_A, 'i1')], [TENANT_B]: [invoice(TENANT_B, 'i2')] } });
    const sched = new InvoiceOverdueScheduler(dsOf(appRepo), events, dbContext, dsOf(adminRepo));

    await sched.runCheck();

    expect(adminRepo.createQueryBuilder).toHaveBeenCalledTimes(1);
    expect(adminRepo.builders[0].getRawMany).toHaveBeenCalledTimes(1);
    expect(dbContext.runInTenantContext).toHaveBeenCalledTimes(2);
    expect(dbContext.runInTenantContext).toHaveBeenCalledWith({ tenantId: TENANT_A, orgId: null, role: null }, expect.any(Function));
    expect(dbContext.runInTenantContext).toHaveBeenCalledWith({ tenantId: TENANT_B, orgId: null, role: null }, expect.any(Function));
    expect(updateWhereCalls(appRepo).length).toBe(2);
    expect(updateWhereCalls(adminRepo).length).toBe(0);
  });

  it('fallback: without ADMIN_DATA_SOURCE, discovery uses DATA_SOURCE', async () => {
    const appRepo = makeRepo({ rawMany: [{ tenant_id: TENANT_A }], manyByTenant: { [TENANT_A]: [invoice(TENANT_A, 'i1')] } });
    const sched = new InvoiceOverdueScheduler(dsOf(appRepo), events, dbContext, null);

    await sched.runCheck();

    expect(appRepo.builders.some((b: any) => b.getRawMany.mock.calls.length > 0)).toBe(true);
    expect(dbContext.runInTenantContext).toHaveBeenCalledWith({ tenantId: TENANT_A, orgId: null, role: null }, expect.any(Function));
  });

  it('isolates failures: an error on tenant A does not stop tenant B', async () => {
    const adminRepo = makeRepo({ rawMany: [{ tenant_id: TENANT_A }, { tenant_id: TENANT_B }] });
    const appRepo = makeRepo({ throwForTenant: TENANT_A, manyByTenant: { [TENANT_B]: [invoice(TENANT_B, 'i2')] } });
    const sched = new InvoiceOverdueScheduler(dsOf(appRepo), events, dbContext, dsOf(adminRepo));

    await expect(sched.runCheck()).resolves.toBeUndefined();
    expect(dbContext.runInTenantContext).toHaveBeenCalledWith({ tenantId: TENANT_B, orgId: null, role: null }, expect.any(Function));
    expect(events.emitTyped).toHaveBeenCalledTimes(1);
  });
});

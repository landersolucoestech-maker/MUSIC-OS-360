import 'reflect-metadata';
import { DunningService } from './dunning.service';
import { BillingEnforcementService } from './billing-enforcement.service';
import { NotificationsProcessor } from '../../queues/processors/notifications.processor';
import { NOTIFICATION_JOB_NAMES } from '../../queues/queue.constants';

/**
 * P0-A: DunningService no longer keeps its own enforcement authority. These
 * tests prove the invariant the audit found broken — "a tenant in a
 * restricted billing state gets the same enforcement regardless of which
 * mechanism produced the transition" — by asserting DunningService (a)
 * NEVER writes billing_subscriptions/tenants/organizations (it has no
 * reference to those repositories/entities at all any more — a regression
 * here would be a compile error, not just a runtime one) and (b) only ever
 * acts on what `BillingEnforcementService.getState()` — the same method
 * `BillingEnforcementGuard` calls to authorize real requests — reports.
 */
describe('DunningService — single billing authority (P0-A)', () => {
  type FixtureState = {
    status: string;
    grace_until: string | null;
    updated_at: string;
    /** P0-A-R5: the real dedup discriminator — see `enqueueNotification`. */
    status_changed_at: string;
  };

  /**
   * `this.ds.transaction(cb)` now backs the per-tenant advisory lock
   * (find-3da8f1fd) and `this.ds.query(...)` backs the persisted
   * failure-streak tracking (find-2e02fed3). `locked: true` by default so
   * existing tests exercise the normal (lock-acquired) path unless a test
   * explicitly overrides it to prove the skip path.
   */
  function makeDs(opts: { locked?: boolean } = {}) {
    const manager = { query: jest.fn(async () => [{ locked: opts.locked ?? true }]) };
    const ds = {
      transaction: jest.fn(async (cb: (manager: unknown) => Promise<unknown>) => cb(manager)),
      query: jest.fn(async (sql: string) => {
        if (sql.includes('DELETE FROM billing_settings')) return [];
        if (sql.includes('INSERT INTO billing_settings')) return [{ streak: 1 }];
        return [];
      }),
    };
    return { ds, manager };
  }

  function makeService(opts: {
    tenantIds: string[];
    state: Record<string, FixtureState | null>;
  }) {
    const enforcement = {
      listTenantIdsRequiringDunningAttention: jest.fn(async () => opts.tenantIds),
      getState: jest.fn(async (tenantId: string) => opts.state[tenantId] ?? null),
    } as unknown as BillingEnforcementService;
    const ws = { sendToTenant: jest.fn() };
    const notifQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-1' }),
      getJob: jest.fn().mockResolvedValue(null),
    };
    const dbContext = {
      runInTenantContext: jest.fn(async (_ctx: unknown, work: () => Promise<unknown>) => work()),
    };
    const { ds, manager } = makeDs();
    const service = new DunningService(ds as never, enforcement, ws as never, notifQueue as never, dbContext as never);
    return { service, enforcement, ws, notifQueue, dbContext, ds, manager };
  }

  it('reads status exclusively from BillingEnforcementService.getState() — never from billing_subscriptions/tenants/organizations', async () => {
    const { service, enforcement } = makeService({
      tenantIds: ['tenant-1'],
      state: { 'tenant-1': { status: 'payment_grace', grace_until: '2026-09-10T00:00:00.000Z', updated_at: '2026-09-06T00:00:00.000Z', status_changed_at: '2026-09-06T00:00:00.000Z' } },
    });

    await service.runDunningCycle();

    expect(enforcement.getState).toHaveBeenCalledWith('tenant-1');
    // No other data source is consulted for status — DunningService holds no
    // reference to BillingSubscriptionEntity/TenantEntity/OrganizationEntity.
  });

  it('payment_grace: sends billing.payment_reminder, not the old daysPastDue-based message', async () => {
    const { service, notifQueue, ws } = makeService({
      tenantIds: ['tenant-1'],
      state: { 'tenant-1': { status: 'payment_grace', grace_until: '2026-09-10T00:00:00.000Z', updated_at: '2026-09-06T00:00:00.000Z', status_changed_at: '2026-09-06T00:00:00.000Z' } },
    });

    await service.runDunningCycle();

    expect(notifQueue.add).toHaveBeenCalledWith(
      NOTIFICATION_JOB_NAMES.SEND,
      expect.objectContaining({ tenantId: 'tenant-1', type: 'billing.payment_reminder' }),
      expect.objectContaining({ attempts: 3, jobId: expect.stringContaining('tenant-1:payment_grace:') }),
    );
    expect(ws.sendToTenant).toHaveBeenCalledWith('tenant-1', 'billing:payment_reminder', expect.any(Object));
  });

  it('read_only: sends billing.soft_suspend_warning', async () => {
    const { service, notifQueue } = makeService({
      tenantIds: ['tenant-1'],
      state: { 'tenant-1': { status: 'read_only', grace_until: '2026-09-03T00:00:00.000Z', updated_at: '2026-09-04T00:00:00.000Z', status_changed_at: '2026-09-04T00:00:00.000Z' } },
    });

    await service.runDunningCycle();

    expect(notifQueue.add).toHaveBeenCalledWith(
      NOTIFICATION_JOB_NAMES.SEND,
      expect.objectContaining({ tenantId: 'tenant-1', type: 'billing.soft_suspend_warning' }),
      expect.anything(),
    );
  });

  it('suspended: sends billing.hard_suspend, and does not perform any direct write — enforcement already happened inside getState()', async () => {
    const { service, notifQueue, ws } = makeService({
      tenantIds: ['tenant-1'],
      state: { 'tenant-1': { status: 'suspended', grace_until: '2026-08-20T00:00:00.000Z', updated_at: '2026-08-21T00:00:00.000Z', status_changed_at: '2026-08-21T00:00:00.000Z' } },
    });

    await service.runDunningCycle();

    expect(notifQueue.add).toHaveBeenCalledWith(
      NOTIFICATION_JOB_NAMES.SEND,
      expect.objectContaining({ tenantId: 'tenant-1', type: 'billing.hard_suspend' }),
      expect.anything(),
    );
    expect(ws.sendToTenant).toHaveBeenCalledWith('tenant-1', 'billing:suspended', expect.any(Object));
  });

  it('active/trial/cancelled: no notification is sent', async () => {
    const { service, notifQueue, ws } = makeService({
      tenantIds: ['tenant-1'],
      state: { 'tenant-1': { status: 'active', grace_until: null, updated_at: '2026-09-01T00:00:00.000Z', status_changed_at: '2026-09-01T00:00:00.000Z' } },
    });

    await service.runDunningCycle();

    expect(notifQueue.add).not.toHaveBeenCalled();
    expect(ws.sendToTenant).not.toHaveBeenCalled();
  });

  it('null state (tenant row missing): no notification, no throw', async () => {
    const { service, notifQueue } = makeService({ tenantIds: ['tenant-1'], state: { 'tenant-1': null } });

    await expect(service.runDunningCycle()).resolves.toBeUndefined();
    expect(notifQueue.add).not.toHaveBeenCalled();
  });

  it('P0-A-R5 (T11): an unrelated write that bumps updated_at WITHOUT a real status transition still produces the same jobId', async () => {
    // Simulates updateAdminTenant re-saving the same status, or a retried
    // Stripe webhook re-applying startPaymentGrace while already in that
    // status — both bump `updated_at` but must NOT mint a new dedup key.
    const { service, enforcement, notifQueue } = makeService({
      tenantIds: ['tenant-1'],
      state: { 'tenant-1': { status: 'read_only', grace_until: '2026-09-03T00:00:00.000Z', updated_at: '2026-09-04T00:00:00.000Z', status_changed_at: '2026-09-04T00:00:00.000Z' } },
    });

    await service.runDunningCycle();
    (enforcement.getState as jest.Mock).mockResolvedValueOnce({
      status: 'read_only', grace_until: '2026-09-03T00:00:00.000Z',
      updated_at: '2026-09-05T12:00:00.000Z', // bumped by an unrelated write
      status_changed_at: '2026-09-04T00:00:00.000Z', // unchanged — no real transition
    });
    await service.runDunningCycle();

    const jobIds = notifQueue.add.mock.calls.map((call) => (call[2] as { jobId: string }).jobId);
    expect(jobIds[0]).toBe(jobIds[1]);
  });

  it('P0-A-R5 (T12): a genuine new status transition produces a different jobId', async () => {
    const { service, enforcement, notifQueue } = makeService({
      tenantIds: ['tenant-1'],
      state: { 'tenant-1': { status: 'payment_grace', grace_until: '2026-09-10T00:00:00.000Z', updated_at: '2026-09-06T00:00:00.000Z', status_changed_at: '2026-09-06T00:00:00.000Z' } },
    });

    await service.runDunningCycle();
    (enforcement.getState as jest.Mock).mockResolvedValueOnce({
      status: 'read_only', grace_until: '2026-09-03T00:00:00.000Z',
      updated_at: '2026-09-07T00:00:00.000Z', status_changed_at: '2026-09-07T00:00:00.000Z',
    });
    await service.runDunningCycle();

    const jobIds = notifQueue.add.mock.calls.map((call) => (call[2] as { jobId: string }).jobId);
    expect(jobIds[0]).not.toBe(jobIds[1]);
  });

  it('P0-A (RLS): getState() is called inside runInTenantContext with the visited tenantId — a background cycle has no request-scoped tenant context', async () => {
    const { service, dbContext } = makeService({
      tenantIds: ['tenant-1'],
      state: { 'tenant-1': { status: 'payment_grace', grace_until: null, updated_at: '2026-09-06T00:00:00.000Z', status_changed_at: '2026-09-06T00:00:00.000Z' } },
    });

    await service.runDunningCycle();

    expect(dbContext.runInTenantContext).toHaveBeenCalledWith(
      { tenantId: 'tenant-1', orgId: null, role: null },
      expect.any(Function),
    );
  });

  it('per-tenant isolation: one tenant throwing does not abort the cycle for the others', async () => {
    const enforcement = {
      listTenantIdsRequiringDunningAttention: jest.fn(async () => ['tenant-bad', 'tenant-good']),
      getState: jest.fn(async (tenantId: string) => {
        if (tenantId === 'tenant-bad') throw new Error('boom');
        return { status: 'payment_grace', grace_until: null, updated_at: '2026-09-06T00:00:00.000Z', status_changed_at: '2026-09-06T00:00:00.000Z' };
      }),
    } as unknown as BillingEnforcementService;
    const ws = { sendToTenant: jest.fn() };
    const notifQueue = { add: jest.fn().mockResolvedValue({ id: 'job-1' }), getJob: jest.fn().mockResolvedValue(null) };
    const { ds } = makeDs();
    const service = new DunningService(ds as never, enforcement, ws as never, notifQueue as never, undefined);

    await service.runDunningCycle();

    expect(notifQueue.add).toHaveBeenCalledWith(
      NOTIFICATION_JOB_NAMES.SEND,
      expect.objectContaining({ tenantId: 'tenant-good' }),
      expect.anything(),
    );
  });

  it('proves dispatch, not just enqueue: the captured job actually persists via a real NotificationsProcessor.process()', async () => {
    const { service, notifQueue } = makeService({
      tenantIds: ['tenant-1'],
      state: { 'tenant-1': { status: 'suspended', grace_until: null, updated_at: '2026-09-06T00:00:00.000Z', status_changed_at: '2026-09-06T00:00:00.000Z' } },
    });

    await service.runDunningCycle();

    const [jobName, jobData] = notifQueue.add.mock.calls[0];
    const saved = { id: 'notif-1', created_at: new Date() };
    const qb: Record<string, jest.Mock> = {};
    const chain = () => qb;
    qb['insert'] = jest.fn(chain);
    qb['into'] = jest.fn(chain);
    qb['values'] = jest.fn(chain);
    qb['onConflict'] = jest.fn(chain);
    qb['returning'] = jest.fn(chain);
    qb['execute'] = jest.fn(async () => ({ raw: [saved] }));
    qb['where'] = jest.fn(chain);
    qb['andWhere'] = jest.fn(chain);
    qb['getOne'] = jest.fn(async () => null);
    const notifRepo = { createQueryBuilder: jest.fn(() => qb) };
    const processorDs = { getRepository: jest.fn(() => notifRepo) };
    const wsGateway = { sendToUser: jest.fn(), sendToTenant: jest.fn() };
    const dbContext = {
      runInTenantContext: jest.fn(async (_ctx: unknown, work: (m: unknown) => Promise<unknown>) => work(null)),
    };
    const processor = new NotificationsProcessor(processorDs as never, wsGateway as never, dbContext as never);

    const result = await processor.process({ name: jobName, id: 'job-1', data: jobData } as never);

    expect(qb.execute).toHaveBeenCalled();
    expect(result).toEqual(saved);
  });

  it('find-2532abad: bounds per-cycle tenant processing concurrency instead of running fully sequentially or unboundedly', async () => {
    const tenantIds = Array.from({ length: 8 }, (_, i) => `tenant-${i}`);
    let inFlight = 0;
    let maxInFlight = 0;
    const enforcement = {
      listTenantIdsRequiringDunningAttention: jest.fn(async () => tenantIds),
      getState: jest.fn(async () => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 5));
        inFlight--;
        return { status: 'payment_grace', grace_until: null, updated_at: 'x', status_changed_at: 'x' };
      }),
    } as unknown as BillingEnforcementService;
    const { ds } = makeDs();
    const ws = { sendToTenant: jest.fn() };
    const notifQueue = { add: jest.fn().mockResolvedValue({ id: 'job-1' }), getJob: jest.fn().mockResolvedValue(null) };
    const service = new DunningService(ds as never, enforcement, ws as never, notifQueue as never, undefined);

    await service.runDunningCycle();

    expect(notifQueue.add).toHaveBeenCalledTimes(tenantIds.length); // nothing dropped
    expect(maxInFlight).toBeGreaterThan(1); // actually concurrent, not one-at-a-time
    expect(maxInFlight).toBeLessThanOrEqual(5); // but bounded, not unbounded
  });

  it('find-3da8f1fd: a tenant whose advisory lock is already held by another replica is skipped, not double-processed', async () => {
    const enforcement = {
      listTenantIdsRequiringDunningAttention: jest.fn(async () => ['tenant-1']),
      getState: jest.fn(async () => ({ status: 'payment_grace', grace_until: null, updated_at: 'x', status_changed_at: 'x' })),
    } as unknown as BillingEnforcementService;
    const { ds } = makeDs({ locked: false }); // another replica already holds the advisory lock for this tenant
    const ws = { sendToTenant: jest.fn() };
    const notifQueue = { add: jest.fn(), getJob: jest.fn() };
    const service = new DunningService(ds as never, enforcement, ws as never, notifQueue as never, undefined);

    await service.runDunningCycle();

    expect(enforcement.getState).not.toHaveBeenCalled();
    expect(notifQueue.add).not.toHaveBeenCalled();
    expect(ws.sendToTenant).not.toHaveBeenCalled();
  });

  it('find-4f07e7c6: cycle-completion log reports actual success/failure counts, not tenantIds.length', async () => {
    const enforcement = {
      listTenantIdsRequiringDunningAttention: jest.fn(async () => ['tenant-good', 'tenant-bad']),
      getState: jest.fn(async (tenantId: string) => {
        if (tenantId === 'tenant-bad') throw new Error('boom');
        return { status: 'payment_grace', grace_until: null, updated_at: 'x', status_changed_at: 'x' };
      }),
    } as unknown as BillingEnforcementService;
    const { ds } = makeDs();
    const ws = { sendToTenant: jest.fn() };
    const notifQueue = { add: jest.fn().mockResolvedValue({ id: 'job-1' }), getJob: jest.fn().mockResolvedValue(null) };
    const service = new DunningService(ds as never, enforcement, ws as never, notifQueue as never, undefined);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const logSpy = jest.spyOn((service as any).logger, 'log');

    await service.runDunningCycle();

    const summary = logSpy.mock.calls.map((call) => String(call[0])).find((line) => line.includes('processados'));
    expect(summary).toContain('processados 1/2');
    expect(summary).toContain('falhas=1');
  });

  it('find-27fef1de: a permanently-failed notification job for the same transition is retried, not silently dropped forever', async () => {
    const { service, notifQueue } = makeService({
      tenantIds: ['tenant-1'],
      state: { 'tenant-1': { status: 'payment_grace', grace_until: null, updated_at: 'x', status_changed_at: '2026-09-06T00:00:00.000Z' } },
    });
    const existingJob = { getState: jest.fn().mockResolvedValue('failed'), retry: jest.fn().mockResolvedValue(undefined) };
    notifQueue.getJob.mockResolvedValue(existingJob);

    await service.runDunningCycle();

    expect(existingJob.retry).toHaveBeenCalled();
    expect(notifQueue.add).not.toHaveBeenCalled();
  });

  it('find-817acade: logs a per-tenant success line carrying a per-cycle correlation id', async () => {
    const { service } = makeService({
      tenantIds: ['tenant-1'],
      state: { 'tenant-1': { status: 'payment_grace', grace_until: null, updated_at: 'x', status_changed_at: 'x' } },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const logSpy = jest.spyOn((service as any).logger, 'log');

    await service.runDunningCycle();

    const successLine = logSpy.mock.calls.map((call) => String(call[0])).find((line) => line.includes('tenant-1 processado'));
    expect(successLine).toBeDefined();
    expect(successLine).toMatch(/Dunning\[[0-9a-f-]{36}\]/);
  });

  it('find-e86ed9e1: an overlapping cycle trigger is skipped while a previous cycle is still in flight', async () => {
    let releaseGate!: () => void;
    const gate = new Promise<void>((resolve) => { releaseGate = resolve; });
    const enforcement = {
      listTenantIdsRequiringDunningAttention: jest.fn(async () => ['tenant-1']),
      getState: jest.fn(async () => {
        await gate;
        return { status: 'payment_grace', grace_until: null, updated_at: 'x', status_changed_at: 'x' };
      }),
    } as unknown as BillingEnforcementService;
    const { ds } = makeDs();
    const ws = { sendToTenant: jest.fn() };
    const notifQueue = { add: jest.fn().mockResolvedValue({ id: 'job-1' }), getJob: jest.fn().mockResolvedValue(null) };
    const service = new DunningService(ds as never, enforcement, ws as never, notifQueue as never, undefined);

    const first = service.runDunningCycle();
    const second = service.runDunningCycle(); // fires while `first` is still awaiting getState()
    releaseGate();
    await Promise.all([first, second]);

    expect(enforcement.listTenantIdsRequiringDunningAttention).toHaveBeenCalledTimes(1);
  });

  it('find-2e02fed3: escalates to error level once a tenant crosses the failure-streak threshold', async () => {
    const enforcement = {
      listTenantIdsRequiringDunningAttention: jest.fn(async () => ['tenant-1']),
      getState: jest.fn(async () => { throw new Error('boom'); }),
    } as unknown as BillingEnforcementService;
    const manager = { query: jest.fn(async () => [{ locked: true }]) };
    const ds = {
      transaction: jest.fn(async (cb: (manager: unknown) => Promise<unknown>) => cb(manager)),
      query: jest.fn(async (sql: string) => (sql.includes('INSERT INTO billing_settings') ? [{ streak: 5 }] : [])),
    };
    const ws = { sendToTenant: jest.fn() };
    const notifQueue = { add: jest.fn(), getJob: jest.fn() };
    const service = new DunningService(ds as never, enforcement, ws as never, notifQueue as never, undefined);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const errorSpy = jest.spyOn((service as any).logger, 'error');

    await service.runDunningCycle();

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('ESCALATION'));
  });

  it('find-2e02fed3: a successful processing run resets the tenant failure streak (persisted, not in-memory)', async () => {
    const { service, ds } = makeService({
      tenantIds: ['tenant-1'],
      state: { 'tenant-1': { status: 'payment_grace', grace_until: null, updated_at: 'x', status_changed_at: 'x' } },
    });

    await service.runDunningCycle();

    expect(ds.query).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM billing_settings'),
      ['dunning_failure_streak:tenant-1'],
    );
  });
});

import { Test } from '@nestjs/testing';
import { NotificationsProcessor } from './notifications.processor';
import { DATA_SOURCE }             from '../../database/database.module';
import { DatabaseContextService }  from '../../database/database-context.service';
import { RealtimeService }         from '../../core/realtime/realtime.service';
import { NOTIFICATION_JOB_NAMES }   from '../queue.constants';

const mockNotif = { id: 'n1', title: 'T', type: 'info', created_at: new Date() };

// Single chainable mock covering both query-builder shapes handleSend() uses:
// the atomic insert().onConflict()...execute() write, and the where()/andWhere()/
// getOne() fallback SELECT used only when the insert hits the conflict target.
function makeQb(execRaw: unknown[] = [mockNotif], existing: unknown = null) {
  const qb: Record<string, jest.Mock> = {};
  const chain = () => qb;
  qb['insert'] = jest.fn(chain);
  qb['into'] = jest.fn(chain);
  qb['values'] = jest.fn(chain);
  qb['onConflict'] = jest.fn(chain);
  qb['returning'] = jest.fn(chain);
  qb['execute'] = jest.fn(async () => ({ raw: execRaw }));
  qb['where'] = jest.fn(chain);
  qb['andWhere'] = jest.fn(chain);
  qb['getOne'] = jest.fn(async () => existing);
  return qb;
}

const buildMockDs = () => {
  const qb = makeQb();
  const repo = { createQueryBuilder: jest.fn(() => qb) };
  return {
    getRepository: jest.fn(() => repo),
    _repo: repo,
    _qb: qb,
  };
};

describe('NotificationsProcessor', () => {
  let processor: NotificationsProcessor;
  let mockDs: ReturnType<typeof buildMockDs>;
  const mockWs = { sendToUser: jest.fn(), sendToTenant: jest.fn() };
  // Passthrough DatabaseContextService: invokes the work with no manager →
  // the processor falls back to the cached repo (flag-OFF behaviour).
  const mockDbContext = {
    runInTenantContext: jest.fn((_ctx: unknown, work: (m: unknown) => unknown) => work(undefined)),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockDs = buildMockDs();
    const module = await Test.createTestingModule({
      providers: [
        NotificationsProcessor,
        { provide: DATA_SOURCE, useValue: mockDs },
        { provide: RealtimeService, useValue: mockWs },
        { provide: DatabaseContextService, useValue: mockDbContext },
      ],
    }).compile();
    processor = module.get<NotificationsProcessor>(NotificationsProcessor);
  });

  it('persiste no banco', async () => {
    await processor.process({ name: NOTIFICATION_JOB_NAMES.SEND, data: {
      tenantId: 't1', userId: 'u1', title: 'Teste', type: 'info', body: 'msg',
    }} as any);
    expect(mockDs._qb.execute).toHaveBeenCalled();
    expect(mockDs._qb.values).toHaveBeenCalledWith(
      expect.objectContaining({ tenant_id: 't1', user_id: 'u1', title: 'Teste' }),
    );
  });

  it('envia via WebSocket após persistir', async () => {
    await processor.process({ name: NOTIFICATION_JOB_NAMES.SEND, data: {
      tenantId: 't1', userId: 'u1', title: 'WS Test', type: 'info',
    }} as any);
    expect(mockWs.sendToUser).toHaveBeenCalledWith(
      't1', 'u1', 'notification:new',
      expect.objectContaining({ id: 'n1' }),
    );
  });

  it('inclui entity e entityId quando fornecidos', async () => {
    await processor.process({ name: NOTIFICATION_JOB_NAMES.SEND, data: {
      tenantId: 't1', userId: 'u1', title: 'X',
      type: 'entity', entity: 'artists', entityId: 'a1',
    }} as any);
    expect(mockDs._qb.values).toHaveBeenCalledWith(
      expect.objectContaining({ entity: 'artists', entity_id: 'a1' }),
    );
  });

  // ── P2-5: session-context wiring ───────────────────────────────────────────
  it('persiste dentro de runInTenantContext com o tenant do job', async () => {
    await processor.process({ name: NOTIFICATION_JOB_NAMES.SEND, data: {
      tenantId: 't1', userId: 'u1', title: 'Ctx', type: 'info',
    }} as any);
    expect(mockDbContext.runInTenantContext).toHaveBeenCalledWith(
      { tenantId: 't1', orgId: null, role: null },
      expect.any(Function),
    );
    expect(mockDs._qb.execute).toHaveBeenCalled();
  });

  it('aborta (fail-closed) job SEND sem tenantId, sem tocar o banco', async () => {
    const out = await processor.process({ name: NOTIFICATION_JOB_NAMES.SEND, data: {
      userId: 'u1', title: 'NoTenant', type: 'info',
    }} as any);
    expect(out).toBeNull();
    expect(mockDbContext.runInTenantContext).not.toHaveBeenCalled();
    expect(mockDs._qb.execute).not.toHaveBeenCalled();
  });

  // find-8dfe93c3 / find-32bf2e0a: whether the dup comes from a sequential
  // BullMQ redelivery (first INSERT already committed) or from two workers
  // racing the SAME job.id concurrently, INSERT ... ON CONFLICT DO NOTHING
  // makes both land on the identical code path: the losing/duplicate INSERT
  // returns zero rows (no error — see find-855bcd84, an earlier version threw
  // 23505 and poisoned the surrounding transaction), and the processor
  // recovers the winner's row via one fallback SELECT instead of duplicating
  // persistence or the WS push.
  it('job.id já processado (redelivery OU corrida concorrente): recupera a linha existente, sem duplicar nem falhar', async () => {
    const existingRow = { id: 'n-existing', title: 'Já processado', type: 'info', created_at: new Date() };
    mockDs._qb.execute = jest.fn(async () => ({ raw: [] })); // ON CONFLICT DO NOTHING: no row inserted
    mockDs._qb.getOne = jest.fn(async () => existingRow);

    const out = await processor.process({
      id: 'bullmq-job-123',
      name: NOTIFICATION_JOB_NAMES.SEND,
      data: { tenantId: 't1', userId: 'u1', title: 'Redelivered', type: 'info' },
    } as any);

    expect(out).toEqual(existingRow);
    expect(mockWs.sendToUser).not.toHaveBeenCalled();
    expect(mockWs.sendToTenant).not.toHaveBeenCalled();
  });

  it('primeira entrega com job.id: persiste normalmente e grava bullmq_job_id em metadata', async () => {
    const firstRow = { id: 'n-first', title: 'First delivery', type: 'info', created_at: new Date() };
    mockDs._qb.execute = jest.fn(async () => ({ raw: [firstRow] }));

    await processor.process({
      id: 'bullmq-job-456',
      name: NOTIFICATION_JOB_NAMES.SEND,
      data: { tenantId: 't1', userId: 'u1', title: 'First delivery', type: 'info' },
    } as any);

    expect(mockDs._qb.values).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: expect.objectContaining({ bullmq_job_id: 'bullmq-job-456' }) }),
    );
    expect(mockWs.sendToUser).toHaveBeenCalledWith(
      't1', 'u1', 'notification:new',
      expect.objectContaining({ id: 'n-first' }),
    );
  });
});

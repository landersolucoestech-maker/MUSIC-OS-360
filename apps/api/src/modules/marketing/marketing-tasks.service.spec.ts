import 'reflect-metadata';
import { MarketingTasksService } from './marketing-tasks.service';

describe('MarketingTasksService status handling (S7)', () => {
  const existing = {
    id: 'task-1',
    tenant_id: 't1',
    marketing_project_id: 'p1',
    title: 'Tarefa',
    status: 'in_progress',
    completed_at: null as Date | null,
    deleted_at: null,
  };

  function makeService() {
    const tasks = {
      findOne: jest.fn().mockResolvedValue(existing),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      create: jest.fn((row: Record<string, unknown>) => row),
      save: jest.fn(async (row: Record<string, unknown>) => row),
    };
    const projects = { findOne: jest.fn().mockResolvedValue({ id: 'p1' }) };
    const ds = { getRepository: jest.fn((entity: { name: string }) => (entity.name === 'MarketingTaskEntity' ? tasks : projects)) };
    return { service: new MarketingTasksService(ds as never), tasks };
  }

  beforeEach(() => jest.clearAllMocks());

  it("stamps completed_at when the task moves to the canonical 'done'", async () => {
    const { service, tasks } = makeService();
    await service.update('t1', 'u1', 'task-1', { status: 'done' } as never);
    const payload = tasks.update.mock.calls[0][1];
    expect(payload.status).toBe('done');
    expect(payload.completed_at).toBeInstanceOf(Date);
  });

  it('keeps an existing completed_at instead of restamping', async () => {
    const { service, tasks } = makeService();
    const earlier = new Date('2026-01-01T00:00:00Z');
    tasks.findOne.mockResolvedValue({ ...existing, completed_at: earlier });
    await service.update('t1', 'u1', 'task-1', { status: 'done' } as never);
    expect(tasks.update.mock.calls[0][1].completed_at).toBe(earlier);
  });

  it.each(['in_progress', 'backlog', 'pending', 'review', 'blocked', 'cancelled'])(
    'does not stamp completed_at for %s',
    async (status) => {
      const { service, tasks } = makeService();
      await service.update('t1', 'u1', 'task-1', { status } as never);
      expect(tasks.update.mock.calls[0][1].completed_at).toBeUndefined();
    },
  );

  it.each(['completed'])(
    "no longer treats the non-canonical '%s' as done (DTO validation rejects it before the service)",
    async (status) => {
      const { service, tasks } = makeService();
      await service.update('t1', 'u1', 'task-1', { status } as never);
      expect(tasks.update.mock.calls[0][1].completed_at).toBeUndefined();
    },
  );

  it('creates with the canonical defaults pending / normal', async () => {
    const { service, tasks } = makeService();
    await service.create('t1', 'u1', { marketingProjectId: 'p1', title: 'Nova' } as never);
    expect(tasks.create).toHaveBeenCalledWith(expect.objectContaining({ status: 'pending', priority: 'normal' }));
  });
});

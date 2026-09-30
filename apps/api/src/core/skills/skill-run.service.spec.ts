import 'reflect-metadata';
import { SkillRunService } from './skill-run.service';

function makeRepo() {
  return {
    create: jest.fn((x: Record<string, unknown>) => x),
    save: jest.fn(async (x: Record<string, unknown>) => ({ ...x, id: 'run-1' })),
    findOne: jest.fn(async () => ({ id: 'run-1', started_at: new Date(Date.now() - 1000) })),
    update: jest.fn(async () => undefined),
    findAndCount: jest.fn(async () => [[{ id: 'run-1', skill_name: 'asset-linking' }], 1]),
    find: jest.fn(async () => [{ id: 'log-1', message: 'ok' }]),
  };
}

function makeDs() {
  const repo = makeRepo();
  return { ds: { getRepository: jest.fn(() => repo) }, repo };
}

function makeEvents() {
  return { emitTyped: jest.fn() };
}

describe('SkillRunService', () => {
  it('start emits skill.started even without DATA_SOURCE (persistence noop)', async () => {
    const events = makeEvents();
    const svc = new SkillRunService(null, events as never);
    const runId = await svc.start({ tenantId: 't1', skillName: 'asset-linking' });
    expect(runId).toBe('');
    expect(events.emitTyped).toHaveBeenCalledWith('skill.started', expect.objectContaining({ tenantId: 't1' }));
  });

  it('run() executes, persists, and emits started + completed', async () => {
    const { ds, repo } = makeDs();
    const events = makeEvents();
    const svc = new SkillRunService(ds as never, events as never);

    const result = await svc.run(
      { tenantId: 't1', skillName: 'asset-linking', entityType: 'upload', entityId: 'u1' },
      async (ctx) => {
        await ctx.log('info', 'step 1');
        return { result: 'ok', output: { done: true } };
      },
    );

    expect(result).toBe('ok');
    expect(repo.save).toHaveBeenCalled();
    expect(repo.update).toHaveBeenCalledWith(
      { id: 'run-1' },
      expect.objectContaining({ status: 'success' }),
    );
    const emitted = events.emitTyped.mock.calls.map((c: unknown[]) => c[0]);
    expect(emitted).toContain('skill.started');
    expect(emitted).toContain('skill.completed');
  });

  it('run() on failure marks failed, emits skill.failed and rethrows', async () => {
    const { ds, repo } = makeDs();
    const events = makeEvents();
    const svc = new SkillRunService(ds as never, events as never);

    await expect(
      svc.run({ tenantId: 't1', skillName: 'asset-linking' }, async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    expect(repo.update).toHaveBeenCalledWith(
      { id: 'run-1' },
      expect.objectContaining({ status: 'failed', error_message: 'boom' }),
    );
    const emitted = events.emitTyped.mock.calls.map((c: unknown[]) => c[0]);
    expect(emitted).toContain('skill.failed');
    // Response-leak regression: the event payload carries a stable code, never the raw text.
    const failed = events.emitTyped.mock.calls.find((c: unknown[]) => c[0] === 'skill.failed');
    expect(failed?.[1].payload).toMatchObject({ errorCode: 'SKILL_RUN_FAILED' });
    expect(JSON.stringify(failed?.[1].payload)).not.toContain('boom');
    expect(failed?.[1].payload).not.toHaveProperty('errorMessage');
  });

  it('listRuns returns a paginated result and respects limits; getRun brings run + logs', async () => {
    const { ds, repo } = makeDs();
    const svc = new SkillRunService(ds as never, makeEvents() as never);

    const page = await svc.listRuns('t1', { limit: 999, offset: -5 });
    expect(page.total).toBe(1);
    expect(page.limit).toBe(100); // clamp 100
    expect(page.offset).toBe(0); // clamp >= 0
    expect(repo.findAndCount).toHaveBeenCalled();

    const detail = await svc.getRun('t1', 'run-1');
    expect(detail?.run.id).toBe('run-1');
    expect(detail?.logs).toHaveLength(1);
  });

  it('listRuns without DATA_SOURCE returns empty', async () => {
    const svc = new SkillRunService(null, makeEvents() as never);
    const page = await svc.listRuns('t1');
    expect(page).toEqual({ data: [], total: 0, limit: 25, offset: 0 });
  });
});

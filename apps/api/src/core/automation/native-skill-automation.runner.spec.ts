import { runNativeSkillAutomation } from './native-skill-automation.runner';

describe('runNativeSkillAutomation — P2-9 context propagation', () => {
  function deps() {
    const manager = {
      query: jest.fn(async (sql: string) => {
        if (/FROM\s+skill_runs/i.test(sql)) return [];
        return undefined;
      }),
    };
    return {
      manager,
      ds: { manager },
      dbContext: {
        runInTenantContext: jest.fn((_ctx: unknown, work: (m: unknown) => unknown) => work(manager)),
      },
      skillRun: {
        start: jest.fn(async () => 'run-1'),
        succeed: jest.fn(async () => undefined),
        fail: jest.fn(async () => undefined),
        log: jest.fn(async () => undefined),
      },
      ai: {
        complete: jest.fn(async () => ({ content: '{}', provider: 'test', model: 'test' })),
      },
    };
  }

  it('executes load/save inside runInTenantContext for tenant-scoped automation', async () => {
    const d = deps();
    const load = jest.fn(async () => ({ metadata: {} }));
    const saveMetadata = jest.fn(async () => undefined);

    await runNativeSkillAutomation(d as never, {
      eventName: 'artist.created',
      skillName: 'artist-profile-analysis',
      tenantId: 't1',
      userId: 'u1',
      entityType: 'artist',
      entityId: 'a1',
      metadataKey: 'aiProfileAnalysis',
      systemPrompt: 'system',
      load,
      getMetadata: (row) => (row as { metadata: Record<string, unknown> }).metadata,
      buildInput: () => ({}),
      buildPrompt: () => 'prompt',
      parseResponse: () => ({ ok: true }),
      saveMetadata,
    });

    expect(d.dbContext.runInTenantContext).toHaveBeenCalledWith(
      { tenantId: 't1', orgId: null, role: null },
      expect.any(Function),
    );
    expect(load).toHaveBeenCalledWith(d.manager);
    expect(saveMetadata).toHaveBeenCalledWith(expect.any(Object), d.manager);
  });

  it('aborts fail-closed when tenantId is missing', async () => {
    const d = deps();
    const load = jest.fn(async () => ({ metadata: {} }));

    await runNativeSkillAutomation(d as never, {
      eventName: 'artist.created',
      skillName: 'artist-profile-analysis',
      tenantId: null,
      userId: 'u1',
      entityType: 'artist',
      entityId: 'a1',
      metadataKey: 'aiProfileAnalysis',
      systemPrompt: 'system',
      load,
      getMetadata: (row) => (row as { metadata: Record<string, unknown> }).metadata,
      buildInput: () => ({}),
      buildPrompt: () => 'prompt',
      parseResponse: () => ({ ok: true }),
      saveMetadata: jest.fn(async () => undefined),
    });

    expect(d.dbContext.runInTenantContext).not.toHaveBeenCalled();
    expect(load).not.toHaveBeenCalled();
  });

  it('reopens context to record a pre-start failure after the rollback', async () => {
    const d = deps();
    let contextActive = false;
    const writes: boolean[] = [];
    d.dbContext.runInTenantContext.mockImplementation(
      async (_ctx: unknown, work: (manager: unknown) => Promise<unknown>) => {
        contextActive = true;
        try {
          return await work(d.manager);
        } finally {
          contextActive = false;
        }
      },
    );
    d.skillRun.start.mockImplementation(async () => {
      writes.push(contextActive);
      return 'failed-run';
    });
    d.skillRun.fail.mockImplementation(async () => {
      writes.push(contextActive);
    });

    await runNativeSkillAutomation(d as never, {
      eventName: 'artist.created',
      skillName: 'artist-profile-analysis',
      tenantId: 'tenant-a',
      userId: 'user-a',
      entityType: 'artist',
      entityId: 'artist-a',
      metadataKey: 'aiProfileAnalysis',
      systemPrompt: 'system',
      load: jest.fn(async () => { throw new Error('load failed'); }),
      getMetadata: () => ({}),
      buildInput: () => ({}),
      buildPrompt: () => 'prompt',
      parseResponse: () => ({}),
      saveMetadata: jest.fn(async () => undefined),
    });

    expect(d.dbContext.runInTenantContext).toHaveBeenCalledTimes(2);
    expect(writes).toEqual([true, true]);
    expect(d.skillRun.fail).toHaveBeenCalledWith(
      'failed-run', 'tenant-a', 'artist-profile-analysis', expect.any(Error),
    );
  });

  it('does not execute writes when DatabaseContextService is unavailable', async () => {
    const d = deps();
    const load = jest.fn(async () => ({ metadata: {} }));

    await runNativeSkillAutomation({ ...d, dbContext: undefined } as never, {
      eventName: 'artist.created',
      skillName: 'artist-profile-analysis',
      tenantId: 'tenant-a',
      userId: 'user-a',
      entityType: 'artist',
      entityId: 'artist-a',
      metadataKey: 'aiProfileAnalysis',
      systemPrompt: 'system',
      load,
      getMetadata: () => ({}),
      buildInput: () => ({}),
      buildPrompt: () => 'prompt',
      parseResponse: () => ({}),
      saveMetadata: jest.fn(async () => undefined),
    });

    expect(load).not.toHaveBeenCalled();
    expect(d.skillRun.start).not.toHaveBeenCalled();
    expect(d.skillRun.fail).not.toHaveBeenCalled();
  });
});

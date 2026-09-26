import 'reflect-metadata';
import { WorkflowAutomationService } from './workflow-automation.service';

function makeExecution() {
  return {
    start: jest.fn(async () => 'exec-1'),
    logAction: jest.fn(async () => undefined),
    finish: jest.fn(async () => 'success'),
  };
}

const events = () => ({ on: jest.fn(), emitTyped: jest.fn() });
const context = () => ({
  runInTenantContext: jest.fn(
    async (_ctx: unknown, work: (manager: unknown) => Promise<unknown>) => work({}),
  ),
});

describe('WorkflowAutomationService.processEvent (per-execution persistence)', () => {
  it('executes actions and records a successful execution', async () => {
    const execution = makeExecution();
    const notifQueue = { add: jest.fn(async () => undefined) };
    const dbContext = context();
    const svc = new WorkflowAutomationService(
      null, events() as never, {} as never, execution as never, notifQueue as never,
      dbContext as never,
    );

    svc.register({ id: 'r1', name: 'Regra 1', event: 'lead.created', actions: [{ type: 'notify', template: 't' }] });
    await svc.processEvent('lead.created', { type: 'lead.created', tenantId: 't1', payload: {} } as never);

    expect(execution.start).toHaveBeenCalledWith(expect.objectContaining({ ruleId: 'r1', actionsTotal: 1 }));
    expect(notifQueue.add).toHaveBeenCalled();
    expect(execution.logAction).toHaveBeenCalledWith('exec-1', 't1', 'notify', 'success');
    expect(execution.finish).toHaveBeenCalledWith('exec-1', expect.objectContaining({ succeeded: 1, failed: 0 }));
    expect(dbContext.runInTenantContext).toHaveBeenCalledWith(
      { tenantId: 't1', orgId: null, role: null },
      expect.any(Function),
    );
  });

  it('a failing action is recorded as failed and sent to the DLQ', async () => {
    const execution = makeExecution();
    // add throws on first use (notification); enqueueDlq swallows the error internally.
    const notifQueue = { add: jest.fn(async (name: string) => { if (name === 'notification') throw new Error('queue down'); }) };
    const svc = new WorkflowAutomationService(
      null, events() as never, {} as never, execution as never, notifQueue as never,
      context() as never,
    );

    svc.register({ id: 'r2', name: 'Regra 2', event: 'release.published', actions: [{ type: 'notify', template: 't' }] });
    await svc.processEvent('release.published', { type: 'release.published', tenantId: 't1', payload: {} } as never);

    expect(execution.logAction).toHaveBeenCalledWith('exec-1', 't1', 'notify', 'failed', expect.any(String));
    expect(execution.finish).toHaveBeenCalledWith('exec-1', expect.objectContaining({ succeeded: 0, failed: 1 }));
  });

  it('there is no "tag" action in the engine (stub removed)', () => {
    const svc = new WorkflowAutomationService(
      null, events() as never, {} as never, makeExecution() as never, null as never,
      context() as never,
    );
    // getTriggers exposes the registered rules; none uses "tag".
    const hasTag = svc.getTriggers().some((r) => r.actions.some((a) => (a as { type: string }).type === 'tag'));
    expect(hasTag).toBe(false);
  });

  it('fails closed without a tenant and does not start workflow_execution', async () => {
    const execution = makeExecution();
    const dbContext = context();
    const svc = new WorkflowAutomationService(
      null, events() as never, {} as never, execution as never, null as never,
      dbContext as never,
    );
    svc.register({ id: 'r3', name: 'Regra 3', event: 'lead.created', actions: [] });

    await svc.processEvent('lead.created', { type: 'lead.created', tenantId: '', payload: {} } as never);

    expect(dbContext.runInTenantContext).not.toHaveBeenCalled();
    expect(execution.start).not.toHaveBeenCalled();
  });

  it('keeps start, logAction and finish within the same async context', async () => {
    let contextActive = false;
    const writes: boolean[] = [];
    const execution = {
      start: jest.fn(async () => { writes.push(contextActive); return 'exec-1'; }),
      logAction: jest.fn(async () => { writes.push(contextActive); }),
      finish: jest.fn(async () => { writes.push(contextActive); return 'success'; }),
    };
    const dbContext = {
      runInTenantContext: jest.fn(async (_ctx: unknown, work: () => Promise<void>) => {
        contextActive = true;
        try {
          await work();
        } finally {
          contextActive = false;
        }
      }),
    };
    const svc = new WorkflowAutomationService(
      null, events() as never, {} as never, execution as never,
      { add: jest.fn(async () => undefined) } as never, dbContext as never,
    );
    svc.register({
      id: 'r4',
      name: 'Regra 4',
      event: 'contract.signed',
      actions: [{ type: 'notify', template: 'signed' }],
    });

    await svc.processEvent(
      'contract.signed',
      { type: 'contract.signed', tenantId: 'tenant-a', payload: {} } as never,
    );

    expect(writes).toEqual([true, true, true]);
  });
});

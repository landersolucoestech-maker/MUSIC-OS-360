import { TransactionEventsHandler } from './transaction-events.handler';

/** P2-9 — context propagation + fail-closed for the transaction-paid handler. */
describe('TransactionEventsHandler — P2-9', () => {
  const makeQb = (one: unknown) => ({
    where: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(one),
    execute: jest.fn().mockResolvedValue({}),
  });

  function build() {
    const contractRepo = { createQueryBuilder: jest.fn(() => makeQb(null)) };
    const taskRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 'existing' }),
      create: jest.fn(), save: jest.fn(),
    };
    const ds = { getRepository: jest.fn().mockReturnValueOnce(contractRepo).mockReturnValueOnce(taskRepo) };
    const activityLogs = { create: jest.fn().mockResolvedValue(undefined) };
    const financialRules = { evaluateRules: jest.fn().mockResolvedValue(undefined) };
    const dbContext = { runInTenantContext: jest.fn((_c: unknown, w: (m: unknown) => unknown) => w(undefined)) };
    const handler = new TransactionEventsHandler(ds as any, activityLogs as any, financialRules as any, dbContext as any);
    return { handler, contractRepo, taskRepo, activityLogs, financialRules, dbContext };
  }

  const payload = { transactionId: 'tx1', contractId: 'c1', amount: 100, paidBy: 'u1', paidAt: '2026-06-12' };

  it('valid tenantId → runs inside runInTenantContext', async () => {
    const { handler, dbContext, activityLogs } = build();
    await handler.onTransactionPaid({ tenantId: 't1', payload, correlationId: null } as any);
    expect(dbContext.runInTenantContext).toHaveBeenCalledWith({ tenantId: 't1', orgId: null, role: null }, expect.any(Function));
    expect(activityLogs.create).toHaveBeenCalledWith('t1', 'u1', expect.objectContaining({ action: 'paid' }));
  });

  it('absent tenantId → aborts (fail-closed), does not touch the database', async () => {
    const { handler, dbContext, contractRepo } = build();
    await handler.onTransactionPaid({ payload, correlationId: null } as any);
    expect(dbContext.runInTenantContext).not.toHaveBeenCalled();
    expect(contractRepo.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('transaction.paid evaluates financial rules with the correct trigger', async () => {
    const { handler, financialRules } = build();
    await handler.onTransactionPaid({ tenantId: 't1', payload, correlationId: null } as any);
    expect(financialRules.evaluateRules).toHaveBeenCalledWith(
      't1', 'transaction.paid',
      expect.objectContaining({ entityId: 'tx1', entityType: 'transaction', amount: 100 }),
    );
  });

  it('paid transaction writes the canonical last_payment_* keys on the linked contract (legacy keys replaced)', async () => {
    const qb = makeQb({ id: 'c1', metadata: { keep: 1, ultimo_pagamento_em: 'old' } });
    const contractRepo = { createQueryBuilder: jest.fn(() => qb) };
    const taskRepo = { findOne: jest.fn().mockResolvedValue({ id: 'existing' }), create: jest.fn(), save: jest.fn() };
    const ds = { getRepository: jest.fn().mockReturnValueOnce(contractRepo).mockReturnValueOnce(taskRepo) };
    const dbContext = { runInTenantContext: jest.fn((_c: unknown, w: (m: unknown) => unknown) => w(undefined)) };
    const handler = new TransactionEventsHandler(ds as any, { create: jest.fn() } as any, { evaluateRules: jest.fn() } as any, dbContext as any);
    await handler.onTransactionPaid({ tenantId: 't1', payload: { ...payload, amount: '100.00' }, correlationId: null } as any);
    const set = (qb.set.mock.calls[0][0] as { metadata: Record<string, unknown> }).metadata;
    expect(set).toEqual({ keep: 1, last_payment_at: '2026-06-12', last_payment_amount: '100.00', last_payment_by: 'u1' });
  });

  describe('onTransactionCreated', () => {
    const createdPayload = { transactionId: 'tx2', type: 'revenue', category: 'royalties', amount: '250' };

    it('evaluates financial rules with the transaction.created trigger', async () => {
      const { handler, financialRules } = build();
      await handler.onTransactionCreated({ tenantId: 't1', payload: createdPayload } as any);
      expect(financialRules.evaluateRules).toHaveBeenCalledWith(
        't1', 'transaction.created',
        expect.objectContaining({ entityId: 'tx2', entityType: 'transaction', amount: 250, category: 'royalties', type: 'revenue' }),
      );
    });

    it('does not evaluate rules when the transaction came from contract.signed (avoids a duplicate trigger)', async () => {
      const { handler, financialRules } = build();
      await handler.onTransactionCreated({
        tenantId: 't1',
        payload: { ...createdPayload, source: 'contract.signed' },
      } as any);
      expect(financialRules.evaluateRules).not.toHaveBeenCalled();
    });

    it('missing tenantId → aborts (fail-closed)', async () => {
      const { handler, financialRules } = build();
      await handler.onTransactionCreated({ payload: createdPayload } as any);
      expect(financialRules.evaluateRules).not.toHaveBeenCalled();
    });
  });
});

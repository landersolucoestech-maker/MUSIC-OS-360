import { ContractEventsHandler } from './contract-events.handler';

/**
 * Decision Gate items 2+3 (GAP-02/03): contract.signed already triggered
 * evaluateRules, but the provisional transaction created here also emits
 * TRANSACTION_CREATED — tagged with source:'contract.signed' so
 * TransactionEventsHandler does not evaluate financial rules TWICE for the same
 * contract signature.
 */
function build() {
  const artistRepo = { update: jest.fn().mockResolvedValue(undefined) };
  const transactionRepo = {
    create: jest.fn((v: unknown) => v),
    save: jest.fn(async (v: unknown) => ({ id: 'tx-new', ...(v as object) })),
  };
  const contractRepo = {
    createQueryBuilder: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({ id: 'c1', fixed_value: '5000' }),
    })),
  };
  const ds = {
    getRepository: jest.fn()
      .mockReturnValueOnce(artistRepo)
      .mockReturnValueOnce(transactionRepo)
      .mockReturnValueOnce(contractRepo),
  };
  const activityLogs = { create: jest.fn().mockResolvedValue(undefined) };
  const events = { emitTyped: jest.fn() };
  const financialRules = { evaluateRules: jest.fn().mockResolvedValue(undefined) };
  const handler = new ContractEventsHandler(ds as any, activityLogs as any, events as any, financialRules as any);
  return { handler, artistRepo, transactionRepo, events, financialRules };
}

function buildWithContract(contract: Record<string, unknown>) {
  const artistRepo = { update: jest.fn().mockResolvedValue(undefined) };
  const transactionRepo = {
    create: jest.fn((v: unknown) => v),
    save: jest.fn(async (v: unknown) => ({ id: 'tx-new', ...(v as object) })),
  };
  const contractRepo = {
    createQueryBuilder: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(contract),
    })),
  };
  const ds = {
    getRepository: jest.fn()
      .mockReturnValueOnce(artistRepo)
      .mockReturnValueOnce(transactionRepo)
      .mockReturnValueOnce(contractRepo),
  };
  const activityLogs = { create: jest.fn().mockResolvedValue(undefined) };
  const events = { emitTyped: jest.fn() };
  const financialRules = { evaluateRules: jest.fn().mockResolvedValue(undefined) };
  const handler = new ContractEventsHandler(ds as any, activityLogs as any, events as any, financialRules as any);
  return { handler, artistRepo, transactionRepo, events, financialRules };
}

describe('ContractEventsHandler — onContractSigned', () => {
  const payload = { contractId: 'c1', title: 'Contrato X', artistId: 'a1', signedBy: 'u1', signedAt: '2026-06-12' };

  it('tags the created transaction with source: contract.signed to avoid duplicate rule evaluation', async () => {
    const { handler, events } = build();
    await handler.onContractSigned({ tenantId: 't1', payload, correlationId: null } as any);

    expect(events.emitTyped).toHaveBeenCalledWith(
      'transaction.created',
      expect.objectContaining({
        payload: expect.objectContaining({ contractId: 'c1', source: 'contract.signed' }),
      }),
    );
  });

  it('evaluates financial rules with the contract.signed trigger', async () => {
    const { handler, financialRules } = build();
    await handler.onContractSigned({ tenantId: 't1', payload, correlationId: null } as any);

    expect(financialRules.evaluateRules).toHaveBeenCalledWith(
      't1', 'contract.signed',
      expect.objectContaining({ entityId: 'c1', entityType: 'contract', amount: 5000, category: 'contratos' }),
    );
  });

  // GAP-0055: the provisional transaction must use the contract's real start
  // date when available, not always "today" (the date the signature
  // webhook/event was processed, which can be long after the real start).
  it('uses contract.start_date as the provisional transaction date when available', async () => {
    const { handler, transactionRepo } = buildWithContract({ id: 'c1', fixed_value: '5000', start_date: new Date('2026-03-01T00:00:00.000Z') });
    await handler.onContractSigned({ tenantId: 't1', payload, correlationId: null } as any);

    expect(transactionRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ transaction_date: new Date('2026-03-01T00:00:00.000Z') }),
    );
  });

  it('uses the current date as a fallback when the contract has no start_date', async () => {
    const { handler, transactionRepo } = buildWithContract({ id: 'c1', fixed_value: '5000', start_date: null });
    await handler.onContractSigned({ tenantId: 't1', payload, correlationId: null } as any);

    const created = transactionRepo.create.mock.calls[0][0] as { transaction_date: Date };
    expect(created.transaction_date).toBeInstanceOf(Date);
    expect(created.transaction_date.getTime()).not.toBeNull();
  });
});

import { ContractEventsHandler } from './contract-events.handler';

/**
 * Decision Gate item 2+3 (GAP-02/03): contract.signed já disparava evaluateRules,
 * mas a transação provisória criada aqui também emite TRANSACTION_CREATED —
 * marcada com source:'contract.signed' para que TransactionEventsHandler não
 * avalie financial-rules DUAS vezes para a mesma assinatura de contrato.
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
        payload: expect.objectContaining({ contratoId: 'c1', source: 'contract.signed' }),
      }),
    );
  });

  it('avalia financial rules com o trigger contract.signed', async () => {
    const { handler, financialRules } = build();
    await handler.onContractSigned({ tenantId: 't1', payload, correlationId: null } as any);

    expect(financialRules.evaluateRules).toHaveBeenCalledWith(
      't1', 'contract.signed',
      expect.objectContaining({ entityId: 'c1', entityType: 'contract', valor: 5000, category: 'contratos' }),
    );
  });

  // GAP-0055: a transação provisória deve usar a data de início real do
  // contrato quando disponível, não sempre "hoje" (data em que o webhook/evento
  // de assinatura foi processado, que pode ser muito depois do início real).
  it('uses contract.start_date as the provisional transaction date when available', async () => {
    const { handler, transactionRepo } = buildWithContract({ id: 'c1', fixed_value: '5000', start_date: new Date('2026-03-01T00:00:00.000Z') });
    await handler.onContractSigned({ tenantId: 't1', payload, correlationId: null } as any);

    expect(transactionRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: new Date('2026-03-01T00:00:00.000Z') }),
    );
  });

  it('uses the current date as a fallback when the contract has no start_date', async () => {
    const { handler, transactionRepo } = buildWithContract({ id: 'c1', fixed_value: '5000', start_date: null });
    await handler.onContractSigned({ tenantId: 't1', payload, correlationId: null } as any);

    const created = transactionRepo.create.mock.calls[0][0] as { data: Date };
    expect(created.data).toBeInstanceOf(Date);
    expect(created.data.getTime()).not.toBeNull();
  });
});

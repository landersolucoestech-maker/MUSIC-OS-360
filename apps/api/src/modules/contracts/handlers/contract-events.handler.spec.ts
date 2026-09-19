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
      getOne: jest.fn().mockResolvedValue({ id: 'c1', valor: '5000' }),
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

  it('marca a transação criada com source: contract.signed para evitar avaliação duplicada de regras', async () => {
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
});

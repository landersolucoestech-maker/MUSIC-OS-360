import 'reflect-metadata';
import { FinancialClassificationAutomation } from './financial-classification.automation';
import { passThroughTenantContext } from '../../../test/helpers/tenant-context.mock';

// ─── Mocks de fronteira (DB / SkillRunService / AIService) ────────────────────

function makeSkillRun() {
  return {
    start: jest.fn(async () => 'run-1'),
    succeed: jest.fn(async () => undefined),
    fail: jest.fn(async () => undefined),
    log: jest.fn(async () => undefined),
  };
}

function makeAi(content: string) {
  return {
    complete: jest.fn(async () => ({
      content,
      provider: 'openai',
      model: 'gpt-4o-mini',
      inputTokens: 1,
      outputTokens: 1,
      costUsd: 0,
      latencyMs: 1,
    })),
  };
}

function makeFailingAi() {
  return { complete: jest.fn(async () => { throw new Error('Nenhum provider de AI configurado'); }) };
}

/**
 * Mock de DataSource que roteia por SQL:
 *  - SELECT ... FROM skill_runs   → skillRunRows
 *  - SELECT ... FROM transactions → txRows
 *  - UPDATE                       → undefined
 */
function makeDs(txRows: unknown[], skillRunRows: unknown[] = []) {
  const query = jest.fn(async (sql: string) => {
    if (/FROM\s+skill_runs/i.test(sql)) return skillRunRows;
    if (/FROM\s+transactions/i.test(sql)) return txRows;
    return undefined;
  });
  return { ds: { query }, query };
}

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    tenantId: 't1',
    payload: {
      transactionId: 'x1',
      tenantId: 't1',
      type: 'despesa',
      categoria: 'Marketing',
      valor: '1500.00',
      contratoId: null,
      artistId: 'a1',
      createdBy: 'u1',
      ...overrides,
    },
  };
}

const TX_ROW = {
  type: 'despesa',
  categoria: 'Marketing',
  descricao: 'Tráfego pago Meta Ads campanha lançamento',
  valor: '1500.00',
  data: '2026-06-10T00:00:00.000Z',
  referencia: null,
  artist_name: 'Banda Aurora',
  metadata: {},
};

const VALID_JSON = JSON.stringify({
  category: 'Marketing / Tráfego pago',
  costCenter: 'marketing',
  suggestedTags: ['ads', 'meta'],
  recurrence: 'one-time',
  confidence: 0.9,
  accountingNotes: ['Verificar nota fiscal do fornecedor'],
  linkedEntitySuggestion: { entityType: 'artist', entityName: 'Banda Aurora', reason: 'Artista informado' },
  risks: [],
  recommendedActions: [],
});

const IDEMPOTENCY_KEY = 'transaction.created:t1:x1';

describe('FinancialClassificationAutomation (transaction.created → financial-classification)', () => {
  it('executa, registra skill_run e grava transactions.metadata.aiClassification no sucesso', async () => {
    const { ds, query } = makeDs([TX_ROW]);
    const skillRun = makeSkillRun();
    const ai = makeAi(VALID_JSON);
    const handler = new FinancialClassificationAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);

    await handler.onTransactionCreated(makeEvent() as never);

    expect(skillRun.start).toHaveBeenCalledWith(
      expect.objectContaining({
        skillName: 'financial-classification',
        entityType: 'transaction',
        entityId: 'x1',
        input: { idempotencyKey: IDEMPOTENCY_KEY },
      }),
    );
    expect(skillRun.succeed).toHaveBeenCalled();
    expect(skillRun.fail).not.toHaveBeenCalled();

    // input: direction=expense (despesa) + descrição + artista no prompt
    const aiCalls = ai.complete.mock.calls as unknown as Array<[{ prompt: string; jsonMode: boolean }]>;
    expect(aiCalls[0][0].jsonMode).toBe(true);
    expect(aiCalls[0][0].prompt).toContain('despesa (expense)');
    expect(aiCalls[0][0].prompt).toContain('Tráfego pago Meta Ads');
    expect(aiCalls[0][0].prompt).toContain('Banda Aurora');

    const updateCall = query.mock.calls.find((c: unknown[]) => /UPDATE\s+transactions/i.test(c[0] as string));
    expect(updateCall).toBeDefined();
    const meta = JSON.parse((updateCall as unknown as [string, string[]])[1][0]);
    expect(meta.aiClassification.source).toBe('native-automation');
    expect(meta.aiClassification.skill).toBe('financial-classification');
    expect(meta.aiClassification.event).toBe('transaction.created');
    expect(meta.aiClassification.idempotencyKey).toBe(IDEMPOTENCY_KEY);
    expect(meta.aiClassification.status).toBe('generated');
    expect(meta.aiClassification.parsed.costCenter).toBe('marketing');
  });

  it('mapeia direction=income para receita', async () => {
    const row = { ...TX_ROW, type: 'receita', descricao: 'Royalties Spotify' };
    const { ds } = makeDs([row]);
    const skillRun = makeSkillRun();
    const ai = makeAi(VALID_JSON);
    const handler = new FinancialClassificationAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);

    await handler.onTransactionCreated(makeEvent({ type: 'receita' }) as never);

    const aiCalls = ai.complete.mock.calls as unknown as Array<[{ prompt: string }]>;
    expect(aiCalls[0][0].prompt).toContain('receita (income)');
  });

  it('metadata idempotency — does not reprocess if already generated with the same key', async () => {
    const row = { ...TX_ROW, metadata: { aiClassification: { idempotencyKey: IDEMPOTENCY_KEY, status: 'generated' } } };
    const { ds, query } = makeDs([row]);
    const skillRun = makeSkillRun();
    const ai = makeAi(VALID_JSON);
    const handler = new FinancialClassificationAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);

    await handler.onTransactionCreated(makeEvent() as never);

    expect(skillRun.start).not.toHaveBeenCalled();
    expect(ai.complete).not.toHaveBeenCalled();
    expect(query.mock.calls.find((c: unknown[]) => /UPDATE/i.test(c[0] as string))).toBeUndefined();
  });

  it('skill_runs idempotency — an in-progress/successful run blocks', async () => {
    const { ds, query } = makeDs([TX_ROW], [{ '1': 1 }]);
    const skillRun = makeSkillRun();
    const ai = makeAi(VALID_JSON);
    const handler = new FinancialClassificationAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);

    await handler.onTransactionCreated(makeEvent() as never);

    expect(skillRun.start).not.toHaveBeenCalled();
    expect(ai.complete).not.toHaveBeenCalled();
    expect(query.mock.calls.find((c: unknown[]) => /UPDATE/i.test(c[0] as string))).toBeUndefined();
  });

  it('an AI failure records fail, does not rethrow and does not write aiClassification', async () => {
    const { ds, query } = makeDs([TX_ROW]);
    const skillRun = makeSkillRun();
    const ai = makeFailingAi();
    const handler = new FinancialClassificationAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);

    await expect(handler.onTransactionCreated(makeEvent() as never)).resolves.toBeUndefined();

    expect(skillRun.fail).toHaveBeenCalledWith('run-1', 't1', 'financial-classification', expect.any(Error));
    expect(skillRun.succeed).not.toHaveBeenCalled();
    expect(query.mock.calls.find((c: unknown[]) => /UPDATE/i.test(c[0] as string))).toBeUndefined();
  });

  it('guard: absent tenantId/transactionId is ignored (no run, no query)', async () => {
    const { ds, query } = makeDs([TX_ROW]);
    const skillRun = makeSkillRun();
    const ai = makeAi(VALID_JSON);
    const handler = new FinancialClassificationAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);

    await handler.onTransactionCreated({ tenantId: 't1', payload: { transactionId: '' } } as never);

    expect(skillRun.start).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });
});

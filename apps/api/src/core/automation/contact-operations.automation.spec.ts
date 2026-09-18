import 'reflect-metadata';
import { ContactOperationsAutomation } from './contact-operations.automation';
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
 *  - SELECT ... FROM skill_runs → skillRunRows
 *  - SELECT ... FROM clients    → clientRows
 *  - UPDATE                     → undefined
 */
function makeDs(clientRows: unknown[], skillRunRows: unknown[] = []) {
  const query = jest.fn(async (sql: string) => {
    if (/FROM\s+skill_runs/i.test(sql)) return skillRunRows;
    if (/FROM\s+clients/i.test(sql)) return clientRows;
    return undefined;
  });
  return { ds: { query }, query };
}

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    tenantId: 't1',
    payload: {
      clientId: 'c1',
      tenantId: 't1',
      nome: 'Banda Aurora Produções',
      categoria: 'CORPORATE_CLIENT',
      tipoPessoa: 'pessoa_juridica',
      sourceLeadId: 'lead-1',
      createdBy: 'u1',
      ...overrides,
    },
  };
}

const CLIENT_ROW = {
  nome: 'Banda Aurora Produções',
  categoria: 'CORPORATE_CLIENT',
  tipo_pessoa: 'pessoa_juridica',
  responsavel_nome: 'Fulano',
  metadata: {},
};

const VALID_JSON = JSON.stringify({
  onboardingSummary: 'Novo cliente corporativo recém-convertido de lead, pronto para kickoff.',
  recommendedActions: [
    { action: 'Agendar reunião de kickoff', priority: 'high' },
    { action: 'Confirmar dados de faturamento', priority: 'medium' },
  ],
  dataGaps: [],
});

const IDEMPOTENCY_KEY = 'client.created:t1:c1';

describe('ContactOperationsAutomation (client.created → contact-operations)', () => {
  it('executa, registra skill_run e grava clients.metadata.aiContactOperations no sucesso', async () => {
    const { ds, query } = makeDs([CLIENT_ROW]);
    const skillRun = makeSkillRun();
    const ai = makeAi(VALID_JSON);
    const handler = new ContactOperationsAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);

    await handler.onClientCreated(makeEvent() as never);

    expect(skillRun.start).toHaveBeenCalledWith(
      expect.objectContaining({
        skillName: 'contact-operations',
        entityType: 'client',
        entityId: 'c1',
        input: { idempotencyKey: IDEMPOTENCY_KEY },
      }),
    );
    expect(skillRun.succeed).toHaveBeenCalled();
    expect(skillRun.fail).not.toHaveBeenCalled();

    const aiCalls = ai.complete.mock.calls as unknown as Array<[{ prompt: string; jsonMode: boolean }]>;
    expect(aiCalls[0][0].jsonMode).toBe(true);
    expect(aiCalls[0][0].prompt).toContain('Banda Aurora Produções');
    expect(aiCalls[0][0].prompt).toContain('Fulano');

    const updateCall = query.mock.calls.find((c: unknown[]) => /UPDATE\s+clients/i.test(c[0] as string));
    expect(updateCall).toBeDefined();
    const meta = JSON.parse((updateCall as unknown as [string, string[]])[1][0]);
    expect(meta.aiContactOperations.source).toBe('native-automation');
    expect(meta.aiContactOperations.skill).toBe('contact-operations');
    expect(meta.aiContactOperations.event).toBe('client.created');
    expect(meta.aiContactOperations.idempotencyKey).toBe(IDEMPOTENCY_KEY);
    expect(meta.aiContactOperations.status).toBe('generated');
    expect(meta.aiContactOperations.parsed.recommendedActions).toHaveLength(2);
  });

  it('sem responsável definido, monta input sem responsavelNome', async () => {
    const row = { ...CLIENT_ROW, responsavel_nome: null };
    const { ds } = makeDs([row]);
    const skillRun = makeSkillRun();
    const ai = makeAi(VALID_JSON);
    const handler = new ContactOperationsAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);

    await handler.onClientCreated(makeEvent() as never);

    const aiCalls = ai.complete.mock.calls as unknown as Array<[{ prompt: string }]>;
    expect(aiCalls[0][0].prompt).toContain('Nenhum responsável foi definido');
  });

  it('idempotência metadata — não reprocessa se já gerado com a mesma chave', async () => {
    const row = { ...CLIENT_ROW, metadata: { aiContactOperations: { idempotencyKey: IDEMPOTENCY_KEY, status: 'generated' } } };
    const { ds, query } = makeDs([row]);
    const skillRun = makeSkillRun();
    const ai = makeAi(VALID_JSON);
    const handler = new ContactOperationsAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);

    await handler.onClientCreated(makeEvent() as never);

    expect(skillRun.start).not.toHaveBeenCalled();
    expect(ai.complete).not.toHaveBeenCalled();
    expect(query.mock.calls.find((c: unknown[]) => /UPDATE/i.test(c[0] as string))).toBeUndefined();
  });

  it('idempotência skill_runs — run em andamento/sucesso bloqueia', async () => {
    const { ds, query } = makeDs([CLIENT_ROW], [{ '1': 1 }]);
    const skillRun = makeSkillRun();
    const ai = makeAi(VALID_JSON);
    const handler = new ContactOperationsAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);

    await handler.onClientCreated(makeEvent() as never);

    expect(skillRun.start).not.toHaveBeenCalled();
    expect(ai.complete).not.toHaveBeenCalled();
    expect(query.mock.calls.find((c: unknown[]) => /UPDATE/i.test(c[0] as string))).toBeUndefined();
  });

  it('falha da IA registra fail, não relança e não grava aiContactOperations', async () => {
    const { ds, query } = makeDs([CLIENT_ROW]);
    const skillRun = makeSkillRun();
    const ai = makeFailingAi();
    const handler = new ContactOperationsAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);

    await expect(handler.onClientCreated(makeEvent() as never)).resolves.toBeUndefined();

    expect(skillRun.fail).toHaveBeenCalledWith('run-1', 't1', 'contact-operations', expect.any(Error));
    expect(skillRun.succeed).not.toHaveBeenCalled();
    expect(query.mock.calls.find((c: unknown[]) => /UPDATE/i.test(c[0] as string))).toBeUndefined();
  });

  it('guarda: tenantId/clientId ausente é ignorado (sem run, sem query)', async () => {
    const { ds, query } = makeDs([CLIENT_ROW]);
    const skillRun = makeSkillRun();
    const ai = makeAi(VALID_JSON);
    const handler = new ContactOperationsAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);

    await handler.onClientCreated({ tenantId: 't1', payload: { clientId: '' } } as never);

    expect(skillRun.start).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });
});

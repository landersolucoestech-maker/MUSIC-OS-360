import 'reflect-metadata';
import { DealsCrmAutomation } from './deals-crm.automation';

function makeSkillRun() {
  return {
    start: jest.fn(async () => 'run-1'),
    succeed: jest.fn(async () => undefined),
    fail: jest.fn(async () => undefined),
    findRecentSuccess: jest.fn(async () => null),
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

const CLIENT = { name: 'Banda Aurora Produções', category: 'CORPORATE_CLIENT' };

const CONTRACTS = [
  { id: 'c1', title: 'Contrato de distribuição', type: 'distribuicao', status: 'signed', valor: '5000.00', start_date: '2026-01-01', end_date: '2026-12-31' },
  { id: 'c2', title: 'Contrato de shows', type: 'shows', status: 'expiring', valor: null, start_date: '2026-01-01', end_date: '2026-02-01' },
  { id: 'c3', title: 'Contrato antigo', type: 'gestao', status: 'cancelled', valor: '1000.00', start_date: null, end_date: null },
];

function makeClients(client: unknown = CLIENT, contracts: unknown = CONTRACTS) {
  return {
    findById: jest.fn(async () => client),
    getContracts: jest.fn(async () => contracts),
  };
}

const VALID_JSON = JSON.stringify({
  pipelineSummary: 'Pipeline com um contrato ativo e um em risco de expirar.',
  recommendedActions: [{ action: 'Iniciar renovação do contrato de shows', priority: 'high' }],
  risks: [{ risk: 'Contrato de shows expirando sem renovação', severity: 'high' }],
});

describe('DealsCrmAutomation (ON_DEMAND: POST /clients/:id/ai/deals-crm)', () => {
  it('deriva dealStage deterministicamente do ContractStatus real e nunca deixa o modelo reclassificar', async () => {
    const skillRun = makeSkillRun();
    const ai = makeAi(VALID_JSON);
    const clients = makeClients();
    const handler = new DealsCrmAutomation(skillRun as never, ai as never, clients as never);

    const result = await handler.run('t1', 'u1', 'client-1');

    expect(clients.findById).toHaveBeenCalledWith('t1', 'client-1');
    expect(clients.getContracts).toHaveBeenCalledWith('t1', 'client-1');
    expect(skillRun.start).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 't1', userId: 'u1', skillName: 'deals-crm', entityType: 'client', entityId: 'client-1' }),
    );

    const aiCalls = ai.complete.mock.calls as unknown as Array<[{ prompt: string }]>;
    expect(aiCalls[0][0].prompt).toContain('estágio: won'); // signed -> won
    expect(aiCalls[0][0].prompt).toContain('estágio: at_risk'); // expiring -> at_risk
    expect(aiCalls[0][0].prompt).toContain('estágio: lost'); // cancelled -> lost
    expect(aiCalls[0][0].prompt).toContain('valor: 5000'); // real valor echoed
    expect(aiCalls[0][0].prompt).toContain('valor: não informado'); // null valor never fabricated

    expect(result.parsed.pipelineSummary).toBeTruthy();
    expect(skillRun.succeed).toHaveBeenCalled();
  });

  it('cliente sem contratos: monta input com deals=[]', async () => {
    const skillRun = makeSkillRun();
    const ai = makeAi(VALID_JSON);
    const clients = makeClients(CLIENT, []);
    const handler = new DealsCrmAutomation(skillRun as never, ai as never, clients as never);

    await handler.run('t1', 'u1', 'client-1');

    const aiCalls = ai.complete.mock.calls as unknown as Array<[{ prompt: string }]>;
    expect(aiCalls[0][0].prompt).toContain('Nenhum deal');
  });

  it('falha da IA registra fail e relança', async () => {
    const skillRun = makeSkillRun();
    const ai = makeFailingAi();
    const clients = makeClients();
    const handler = new DealsCrmAutomation(skillRun as never, ai as never, clients as never);

    await expect(handler.run('t1', 'u1', 'client-1')).rejects.toThrow('Nenhum provider de AI configurado');
    expect(skillRun.fail).toHaveBeenCalledWith('run-1', 't1', 'deals-crm', expect.any(Error));
  });
});

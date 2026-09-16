import 'reflect-metadata';
import { CampaignStrategyAutomation } from './campaign-strategy.automation';
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
 *  - SELECT ... FROM campaigns  → campaignRows
 *  - UPDATE                     → undefined
 */
function makeDs(campaignRows: unknown[], skillRunRows: unknown[] = []) {
  const query = jest.fn(async (sql: string) => {
    if (/FROM\s+skill_runs/i.test(sql)) return skillRunRows;
    if (/FROM\s+campaigns/i.test(sql)) return campaignRows;
    return undefined;
  });
  return { ds: { query }, query };
}

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    tenantId: 't1',
    payload: {
      campaignId: 'c1',
      tenantId: 't1',
      title: 'Lançamento Single Verão',
      startedBy: 'u1',
      startedAt: '2026-07-01T00:00:00.000Z',
      ...overrides,
    },
  };
}

const CAMPAIGN_ROW = {
  nome: 'Lançamento Single Verão',
  type: 'lançamento',
  objetivo: 'Maximizar streams na primeira semana',
  start_date: '2026-07-01T00:00:00.000Z',
  end_date: '2026-07-31T00:00:00.000Z',
  metadata: {
    aiCampaignPlan: { parsed: { planSummary: 'Foco em redes sociais e playlists editoriais.' } },
  },
  artist_name: 'Banda Aurora',
};

const VALID_JSON = JSON.stringify({
  strategicDirection: 'Construir expectativa via conteúdo de bastidores.',
  targetAudience: 'Fãs de pop nacional, 18-24 anos',
  competitivePositioning: 'Diferenciação por autenticidade',
  keyMessages: [{ message: 'Uma nova era começa', audience: 'fãs atuais' }],
  metricsToWatch: [{ metric: 'engajamento em stories', why: 'sinal antecipado de interesse' }],
  adjustmentTriggers: [{ signal: 'queda de engajamento', severity: 'medium', response: 'reforçar conteúdo orgânico' }],
});

const IDEMPOTENCY_KEY = 'campaign.started:t1:c1';

describe('CampaignStrategyAutomation (campaign.started → campaign-strategy)', () => {
  it('executa, registra skill_run e grava campaigns.metadata.aiCampaignStrategy no sucesso', async () => {
    const { ds, query } = makeDs([CAMPAIGN_ROW]);
    const skillRun = makeSkillRun();
    const ai = makeAi(VALID_JSON);
    const handler = new CampaignStrategyAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);

    await handler.onCampaignStarted(makeEvent() as never);

    expect(skillRun.start).toHaveBeenCalledWith(
      expect.objectContaining({
        skillName: 'campaign-strategy',
        entityType: 'campaign',
        entityId: 'c1',
        input: { idempotencyKey: IDEMPOTENCY_KEY },
      }),
    );
    expect(skillRun.succeed).toHaveBeenCalled();
    expect(skillRun.fail).not.toHaveBeenCalled();

    // reaproveita o resumo real do plano tático já gerado por campaign-plan
    const aiCalls = ai.complete.mock.calls as unknown as Array<[{ prompt: string; jsonMode: boolean }]>;
    expect(aiCalls[0][0].jsonMode).toBe(true);
    expect(aiCalls[0][0].prompt).toContain('Foco em redes sociais e playlists editoriais.');
    expect(aiCalls[0][0].prompt).toContain('Banda Aurora');

    const updateCall = query.mock.calls.find((c: unknown[]) => /UPDATE\s+campaigns/i.test(c[0] as string));
    expect(updateCall).toBeDefined();
    const meta = JSON.parse((updateCall as unknown as [string, string[]])[1][0]);
    expect(meta.aiCampaignStrategy.source).toBe('native-automation');
    expect(meta.aiCampaignStrategy.skill).toBe('campaign-strategy');
    expect(meta.aiCampaignStrategy.event).toBe('campaign.started');
    expect(meta.aiCampaignStrategy.idempotencyKey).toBe(IDEMPOTENCY_KEY);
    expect(meta.aiCampaignStrategy.status).toBe('generated');
    expect(meta.aiCampaignStrategy.parsed.targetAudience).toBe('Fãs de pop nacional, 18-24 anos');
  });

  it('sem plano tático prévio, monta input sem existingPlanSummary', async () => {
    const row = { ...CAMPAIGN_ROW, metadata: {} };
    const { ds } = makeDs([row]);
    const skillRun = makeSkillRun();
    const ai = makeAi(VALID_JSON);
    const handler = new CampaignStrategyAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);

    await handler.onCampaignStarted(makeEvent() as never);

    const aiCalls = ai.complete.mock.calls as unknown as Array<[{ prompt: string }]>;
    expect(aiCalls[0][0].prompt).not.toContain('Foco em redes sociais');
  });

  it('idempotência metadata — não reprocessa se já gerado com a mesma chave', async () => {
    const row = { ...CAMPAIGN_ROW, metadata: { aiCampaignStrategy: { idempotencyKey: IDEMPOTENCY_KEY, status: 'generated' } } };
    const { ds, query } = makeDs([row]);
    const skillRun = makeSkillRun();
    const ai = makeAi(VALID_JSON);
    const handler = new CampaignStrategyAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);

    await handler.onCampaignStarted(makeEvent() as never);

    expect(skillRun.start).not.toHaveBeenCalled();
    expect(ai.complete).not.toHaveBeenCalled();
    expect(query.mock.calls.find((c: unknown[]) => /UPDATE/i.test(c[0] as string))).toBeUndefined();
  });

  it('idempotência skill_runs — run em andamento/sucesso bloqueia', async () => {
    const { ds, query } = makeDs([CAMPAIGN_ROW], [{ '1': 1 }]);
    const skillRun = makeSkillRun();
    const ai = makeAi(VALID_JSON);
    const handler = new CampaignStrategyAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);

    await handler.onCampaignStarted(makeEvent() as never);

    expect(skillRun.start).not.toHaveBeenCalled();
    expect(ai.complete).not.toHaveBeenCalled();
    expect(query.mock.calls.find((c: unknown[]) => /UPDATE/i.test(c[0] as string))).toBeUndefined();
  });

  it('falha da IA registra fail, não relança e não grava aiCampaignStrategy', async () => {
    const { ds, query } = makeDs([CAMPAIGN_ROW]);
    const skillRun = makeSkillRun();
    const ai = makeFailingAi();
    const handler = new CampaignStrategyAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);

    await expect(handler.onCampaignStarted(makeEvent() as never)).resolves.toBeUndefined();

    expect(skillRun.fail).toHaveBeenCalledWith('run-1', 't1', 'campaign-strategy', expect.any(Error));
    expect(skillRun.succeed).not.toHaveBeenCalled();
    expect(query.mock.calls.find((c: unknown[]) => /UPDATE/i.test(c[0] as string))).toBeUndefined();
  });

  it('guarda: tenantId/campaignId ausente é ignorado (sem run, sem query)', async () => {
    const { ds, query } = makeDs([CAMPAIGN_ROW]);
    const skillRun = makeSkillRun();
    const ai = makeAi(VALID_JSON);
    const handler = new CampaignStrategyAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);

    await handler.onCampaignStarted({ tenantId: 't1', payload: { campaignId: '' } } as never);

    expect(skillRun.start).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });
});

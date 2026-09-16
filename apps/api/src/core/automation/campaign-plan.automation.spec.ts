import 'reflect-metadata';
import { CampaignPlanAutomation } from './campaign-plan.automation';
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
      createdBy: 'u1',
      ...overrides,
    },
  };
}

const CAMPAIGN_ROW = {
  nome: 'Lançamento Single Verão',
  type: 'lançamento',
  objetivo: 'Maximizar streams na primeira semana',
  orcamento: '5000.00',
  start_date: '2026-07-01T00:00:00.000Z',
  end_date: '2026-07-31T00:00:00.000Z',
  metadata: {},
  artist_name: 'Banda Aurora',
};

const VALID_JSON = JSON.stringify({
  planSummary: 'Foco em redes sociais e playlists editoriais.',
  channels: [
    { channel: 'Instagram', rationale: 'Alcance do público-alvo', suggestedBudgetSharePercent: 60 },
    { channel: 'TikTok', rationale: 'Viralização', suggestedBudgetSharePercent: 40 },
  ],
  milestones: [{ milestone: 'Teaser', timing: '1 semana antes' }],
  suggestedTasks: [{ task: 'Criar arte de capa', area: 'design', priority: 'high' }],
  risks: [{ risk: 'Baixo orçamento de mídia', severity: 'medium', mitigation: 'Priorizar orgânico' }],
  budgetNotes: 'Orçamento concentrado na primeira semana.',
});

const IDEMPOTENCY_KEY = 'campaign.created:t1:c1';

describe('CampaignPlanAutomation (campaign.created → campaign-plan)', () => {
  it('executa, registra skill_run e grava campaigns.metadata.aiCampaignPlan no sucesso', async () => {
    const { ds, query } = makeDs([CAMPAIGN_ROW]);
    const skillRun = makeSkillRun();
    const ai = makeAi(VALID_JSON);
    const handler = new CampaignPlanAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);

    await handler.onCampaignCreated(makeEvent() as never);

    expect(skillRun.start).toHaveBeenCalledWith(
      expect.objectContaining({
        skillName: 'campaign-plan',
        entityType: 'campaign',
        entityId: 'c1',
        input: { idempotencyKey: IDEMPOTENCY_KEY },
      }),
    );
    expect(skillRun.succeed).toHaveBeenCalled();
    expect(skillRun.fail).not.toHaveBeenCalled();

    const aiCalls = ai.complete.mock.calls as unknown as Array<[{ prompt: string; jsonMode: boolean }]>;
    expect(aiCalls[0][0].jsonMode).toBe(true);
    expect(aiCalls[0][0].prompt).toContain('Lançamento Single Verão');
    expect(aiCalls[0][0].prompt).toContain('Banda Aurora');

    const updateCall = query.mock.calls.find((c: unknown[]) => /UPDATE\s+campaigns/i.test(c[0] as string));
    expect(updateCall).toBeDefined();
    const meta = JSON.parse((updateCall as unknown as [string, string[]])[1][0]);
    expect(meta.aiCampaignPlan.source).toBe('native-automation');
    expect(meta.aiCampaignPlan.skill).toBe('campaign-plan');
    expect(meta.aiCampaignPlan.event).toBe('campaign.created');
    expect(meta.aiCampaignPlan.idempotencyKey).toBe(IDEMPOTENCY_KEY);
    expect(meta.aiCampaignPlan.status).toBe('generated');
    expect(meta.aiCampaignPlan.parsed.channels).toHaveLength(2);
    // renormalização: soma dos percentuais deve ser exatamente 100
    const sum = meta.aiCampaignPlan.parsed.channels.reduce(
      (acc: number, ch: { suggestedBudgetSharePercent: number }) => acc + ch.suggestedBudgetSharePercent,
      0,
    );
    expect(sum).toBe(100);
  });

  it('sem artista/orçamento vinculado, monta input sem esses campos opcionais', async () => {
    const row = { ...CAMPAIGN_ROW, artist_name: null, orcamento: null };
    const { ds } = makeDs([row]);
    const skillRun = makeSkillRun();
    const ai = makeAi(VALID_JSON);
    const handler = new CampaignPlanAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);

    await handler.onCampaignCreated(makeEvent() as never);

    const aiCalls = ai.complete.mock.calls as unknown as Array<[{ prompt: string }]>;
    expect(aiCalls[0][0].prompt).not.toContain('Banda Aurora');
  });

  it('idempotência metadata — não reprocessa se já gerado com a mesma chave', async () => {
    const row = { ...CAMPAIGN_ROW, metadata: { aiCampaignPlan: { idempotencyKey: IDEMPOTENCY_KEY, status: 'generated' } } };
    const { ds, query } = makeDs([row]);
    const skillRun = makeSkillRun();
    const ai = makeAi(VALID_JSON);
    const handler = new CampaignPlanAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);

    await handler.onCampaignCreated(makeEvent() as never);

    expect(skillRun.start).not.toHaveBeenCalled();
    expect(ai.complete).not.toHaveBeenCalled();
    expect(query.mock.calls.find((c: unknown[]) => /UPDATE/i.test(c[0] as string))).toBeUndefined();
  });

  it('idempotência skill_runs — run em andamento/sucesso bloqueia', async () => {
    const { ds, query } = makeDs([CAMPAIGN_ROW], [{ '1': 1 }]);
    const skillRun = makeSkillRun();
    const ai = makeAi(VALID_JSON);
    const handler = new CampaignPlanAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);

    await handler.onCampaignCreated(makeEvent() as never);

    expect(skillRun.start).not.toHaveBeenCalled();
    expect(ai.complete).not.toHaveBeenCalled();
    expect(query.mock.calls.find((c: unknown[]) => /UPDATE/i.test(c[0] as string))).toBeUndefined();
  });

  it('falha da IA registra fail, não relança e não grava aiCampaignPlan', async () => {
    const { ds, query } = makeDs([CAMPAIGN_ROW]);
    const skillRun = makeSkillRun();
    const ai = makeFailingAi();
    const handler = new CampaignPlanAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);

    await expect(handler.onCampaignCreated(makeEvent() as never)).resolves.toBeUndefined();

    expect(skillRun.fail).toHaveBeenCalledWith('run-1', 't1', 'campaign-plan', expect.any(Error));
    expect(skillRun.succeed).not.toHaveBeenCalled();
    expect(query.mock.calls.find((c: unknown[]) => /UPDATE/i.test(c[0] as string))).toBeUndefined();
  });

  it('guarda: tenantId/campaignId ausente é ignorado (sem run, sem query)', async () => {
    const { ds, query } = makeDs([CAMPAIGN_ROW]);
    const skillRun = makeSkillRun();
    const ai = makeAi(VALID_JSON);
    const handler = new CampaignPlanAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);

    await handler.onCampaignCreated({ tenantId: 't1', payload: { campaignId: '' } } as never);

    expect(skillRun.start).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });
});

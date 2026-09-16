import 'reflect-metadata';
import { CampaignReportAutomation } from './campaign-report.automation';
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
 *  - SELECT ... FROM campaigns  → campaignRows (inclui subselects de campaign_tasks/campaign_assets)
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
      endedAt: '2026-07-31T00:00:00.000Z',
      ...overrides,
    },
  };
}

const CAMPAIGN_ROW = {
  nome: 'Lançamento Single Verão',
  type: 'lançamento',
  objetivo: 'Maximizar streams na primeira semana',
  status: 'completed',
  start_date: '2026-07-01T00:00:00.000Z',
  end_date: '2026-07-31T00:00:00.000Z',
  metadata: {},
  artist_name: 'Banda Aurora',
  tasks_total: '5',
  tasks_completed: '4',
  assets_used_count: '3',
};

// Resposta do provider TENTA reivindicar dados medidos mesmo sem externalMetrics real no input —
// o parser da skill (enforceNoFabricatedMetrics) deve rebaixar isso independentemente do que o
// modelo disse, já que o runner nunca chama validateOutput.
const FABRICATING_JSON = JSON.stringify({
  executionSummary: 'Campanha concluída com sucesso.',
  hasMeasuredPerformanceData: true,
  metricSummaries: [{ metric: 'impressões', availability: 'actual', summary: '120.000 impressões' }],
  lessonsLearned: [{ lesson: 'Antecipar produção de assets', category: 'cronograma' }],
  recommendations: [{ recommendation: 'Reservar mais tempo de pré-produção', forNextCampaignType: 'lançamento' }],
});

const IDEMPOTENCY_KEY = 'campaign.ended:t1:c1';

describe('CampaignReportAutomation (campaign.ended → campaign-report)', () => {
  it('executa, registra skill_run e grava campaigns.metadata.aiCampaignReport no sucesso', async () => {
    const { ds, query } = makeDs([CAMPAIGN_ROW]);
    const skillRun = makeSkillRun();
    const ai = makeAi(FABRICATING_JSON);
    const handler = new CampaignReportAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);

    await handler.onCampaignEnded(makeEvent() as never);

    expect(skillRun.start).toHaveBeenCalledWith(
      expect.objectContaining({
        skillName: 'campaign-report',
        entityType: 'campaign',
        entityId: 'c1',
        input: { idempotencyKey: IDEMPOTENCY_KEY },
      }),
    );
    expect(skillRun.succeed).toHaveBeenCalled();
    expect(skillRun.fail).not.toHaveBeenCalled();

    const aiCalls = ai.complete.mock.calls as unknown as Array<[{ prompt: string; jsonMode: boolean }]>;
    expect(aiCalls[0][0].jsonMode).toBe(true);
    expect(aiCalls[0][0].prompt).toContain('concluída');
    expect(aiCalls[0][0].prompt).toContain('4 de 5 concluídas');

    const updateCall = query.mock.calls.find((c: unknown[]) => /UPDATE\s+campaigns/i.test(c[0] as string));
    expect(updateCall).toBeDefined();
    const meta = JSON.parse((updateCall as unknown as [string, string[]])[1][0]);
    expect(meta.aiCampaignReport.source).toBe('native-automation');
    expect(meta.aiCampaignReport.skill).toBe('campaign-report');
    expect(meta.aiCampaignReport.event).toBe('campaign.ended');
    expect(meta.aiCampaignReport.idempotencyKey).toBe(IDEMPOTENCY_KEY);
    expect(meta.aiCampaignReport.status).toBe('generated');
  });

  it('ANTI-FABRICAÇÃO: sem externalMetrics no input, hasMeasuredPerformanceData é forçado a false e availability="actual" é rebaixado, mesmo quando o provider reivindica dados medidos', async () => {
    const { ds, query } = makeDs([CAMPAIGN_ROW]);
    const skillRun = makeSkillRun();
    const ai = makeAi(FABRICATING_JSON);
    const handler = new CampaignReportAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);

    await handler.onCampaignEnded(makeEvent() as never);

    const updateCall = query.mock.calls.find((c: unknown[]) => /UPDATE\s+campaigns/i.test(c[0] as string));
    const meta = JSON.parse((updateCall as unknown as [string, string[]])[1][0]);
    const parsed = meta.aiCampaignReport.parsed;

    expect(parsed.hasMeasuredPerformanceData).toBe(false);
    expect(parsed.metricSummaries.every((m: { availability: string }) => m.availability !== 'actual')).toBe(true);
  });

  it('campanha com status cancelled monta outcomeStatus=cancelled', async () => {
    const row = { ...CAMPAIGN_ROW, status: 'cancelled' };
    const { ds } = makeDs([row]);
    const skillRun = makeSkillRun();
    const ai = makeAi(FABRICATING_JSON);
    const handler = new CampaignReportAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);

    await handler.onCampaignEnded(makeEvent() as never);

    const aiCalls = ai.complete.mock.calls as unknown as Array<[{ prompt: string }]>;
    expect(aiCalls[0][0].prompt).toContain('cancelada');
  });

  it('sem tarefas/assets registrados, monta input sem esses campos opcionais', async () => {
    const row = { ...CAMPAIGN_ROW, tasks_total: '0', tasks_completed: '0', assets_used_count: '0' };
    const { ds } = makeDs([row]);
    const skillRun = makeSkillRun();
    const ai = makeAi(FABRICATING_JSON);
    const handler = new CampaignReportAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);

    await handler.onCampaignEnded(makeEvent() as never);

    const aiCalls = ai.complete.mock.calls as unknown as Array<[{ prompt: string }]>;
    expect(aiCalls[0][0].prompt).not.toContain('concluídas');
  });

  it('idempotência metadata — não reprocessa se já gerado com a mesma chave', async () => {
    const row = { ...CAMPAIGN_ROW, metadata: { aiCampaignReport: { idempotencyKey: IDEMPOTENCY_KEY, status: 'generated' } } };
    const { ds, query } = makeDs([row]);
    const skillRun = makeSkillRun();
    const ai = makeAi(FABRICATING_JSON);
    const handler = new CampaignReportAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);

    await handler.onCampaignEnded(makeEvent() as never);

    expect(skillRun.start).not.toHaveBeenCalled();
    expect(ai.complete).not.toHaveBeenCalled();
    expect(query.mock.calls.find((c: unknown[]) => /UPDATE/i.test(c[0] as string))).toBeUndefined();
  });

  it('idempotência skill_runs — run em andamento/sucesso bloqueia', async () => {
    const { ds, query } = makeDs([CAMPAIGN_ROW], [{ '1': 1 }]);
    const skillRun = makeSkillRun();
    const ai = makeAi(FABRICATING_JSON);
    const handler = new CampaignReportAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);

    await handler.onCampaignEnded(makeEvent() as never);

    expect(skillRun.start).not.toHaveBeenCalled();
    expect(ai.complete).not.toHaveBeenCalled();
    expect(query.mock.calls.find((c: unknown[]) => /UPDATE/i.test(c[0] as string))).toBeUndefined();
  });

  it('falha da IA registra fail, não relança e não grava aiCampaignReport', async () => {
    const { ds, query } = makeDs([CAMPAIGN_ROW]);
    const skillRun = makeSkillRun();
    const ai = makeFailingAi();
    const handler = new CampaignReportAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);

    await expect(handler.onCampaignEnded(makeEvent() as never)).resolves.toBeUndefined();

    expect(skillRun.fail).toHaveBeenCalledWith('run-1', 't1', 'campaign-report', expect.any(Error));
    expect(skillRun.succeed).not.toHaveBeenCalled();
    expect(query.mock.calls.find((c: unknown[]) => /UPDATE/i.test(c[0] as string))).toBeUndefined();
  });

  it('guarda: tenantId/campaignId ausente é ignorado (sem run, sem query)', async () => {
    const { ds, query } = makeDs([CAMPAIGN_ROW]);
    const skillRun = makeSkillRun();
    const ai = makeAi(FABRICATING_JSON);
    const handler = new CampaignReportAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);

    await handler.onCampaignEnded({ tenantId: 't1', payload: { campaignId: '' } } as never);

    expect(skillRun.start).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });
});

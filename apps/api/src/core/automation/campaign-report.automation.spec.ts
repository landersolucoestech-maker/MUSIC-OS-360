import 'reflect-metadata';
import { CampaignReportAutomation } from './campaign-report.automation';
import { passThroughTenantContext } from '../../../test/helpers/tenant-context.mock';

// ─── Boundary mocks (DB / SkillRunService / AIService) ────────────────────────

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
  return { complete: jest.fn(async () => { throw new Error('No AI provider configured'); }) };
}

/**
 * DataSource mock that routes by SQL:
 *  - SELECT ... FROM skill_runs → skillRunRows
 *  - SELECT ... FROM campaigns  → campaignRows (includes campaign_tasks/campaign_assets subselects)
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
  name: 'Lançamento Single Verão',
  type: 'lançamento',
  objective: 'Maximizar streams na primeira semana',
  status: 'completed',
  start_date: '2026-07-01T00:00:00.000Z',
  end_date: '2026-07-31T00:00:00.000Z',
  metadata: {},
  artist_name: 'Banda Aurora',
  tasks_total: '5',
  tasks_completed: '4',
  assets_used_count: '3',
};

// The provider response TRIES to claim measured data even without real externalMetrics in the
// input — the skill's parser (enforceNoFabricatedMetrics) must downgrade this regardless of what
// the model said, since the runner never calls validateOutput.
const FABRICATING_JSON = JSON.stringify({
  executionSummary: 'Campanha concluída com sucesso.',
  hasMeasuredPerformanceData: true,
  metricSummaries: [{ metric: 'impressões', availability: 'actual', summary: '120.000 impressões' }],
  lessonsLearned: [{ lesson: 'Antecipar produção de assets', category: 'cronograma' }],
  recommendations: [{ recommendation: 'Reservar mais tempo de pré-produção', forNextCampaignType: 'lançamento' }],
});

const IDEMPOTENCY_KEY = 'campaign.ended:t1:c1';

describe('CampaignReportAutomation (campaign.ended → campaign-report)', () => {
  it('executes, records skill_run and writes campaigns.metadata.aiCampaignReport on success', async () => {
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

  it('ANTI-FABRICATION: without externalMetrics in the input, hasMeasuredPerformanceData is forced to false and availability="actual" is downgraded, even when the provider claims measured data', async () => {
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

  it('campaign with status cancelled builds outcomeStatus=cancelled', async () => {
    const row = { ...CAMPAIGN_ROW, status: 'cancelled' };
    const { ds } = makeDs([row]);
    const skillRun = makeSkillRun();
    const ai = makeAi(FABRICATING_JSON);
    const handler = new CampaignReportAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);

    await handler.onCampaignEnded(makeEvent() as never);

    const aiCalls = ai.complete.mock.calls as unknown as Array<[{ prompt: string }]>;
    expect(aiCalls[0][0].prompt).toContain('cancelada');
  });

  it('without registered tasks/assets, builds input without those optional fields', async () => {
    const row = { ...CAMPAIGN_ROW, tasks_total: '0', tasks_completed: '0', assets_used_count: '0' };
    const { ds } = makeDs([row]);
    const skillRun = makeSkillRun();
    const ai = makeAi(FABRICATING_JSON);
    const handler = new CampaignReportAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);

    await handler.onCampaignEnded(makeEvent() as never);

    const aiCalls = ai.complete.mock.calls as unknown as Array<[{ prompt: string }]>;
    expect(aiCalls[0][0].prompt).not.toContain('concluídas');
  });

  it('metadata idempotency — does not reprocess if already generated with the same key', async () => {
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

  it('skill_runs idempotency — an in-progress/successful run blocks', async () => {
    const { ds, query } = makeDs([CAMPAIGN_ROW], [{ '1': 1 }]);
    const skillRun = makeSkillRun();
    const ai = makeAi(FABRICATING_JSON);
    const handler = new CampaignReportAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);

    await handler.onCampaignEnded(makeEvent() as never);

    expect(skillRun.start).not.toHaveBeenCalled();
    expect(ai.complete).not.toHaveBeenCalled();
    expect(query.mock.calls.find((c: unknown[]) => /UPDATE/i.test(c[0] as string))).toBeUndefined();
  });

  it('AI failure records fail, does not rethrow and does not write aiCampaignReport', async () => {
    const { ds, query } = makeDs([CAMPAIGN_ROW]);
    const skillRun = makeSkillRun();
    const ai = makeFailingAi();
    const handler = new CampaignReportAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);

    await expect(handler.onCampaignEnded(makeEvent() as never)).resolves.toBeUndefined();

    expect(skillRun.fail).toHaveBeenCalledWith('run-1', 't1', 'campaign-report', expect.any(Error));
    expect(skillRun.succeed).not.toHaveBeenCalled();
    expect(query.mock.calls.find((c: unknown[]) => /UPDATE/i.test(c[0] as string))).toBeUndefined();
  });

  it('guard: missing tenantId/campaignId is ignored (no run, no query)', async () => {
    const { ds, query } = makeDs([CAMPAIGN_ROW]);
    const skillRun = makeSkillRun();
    const ai = makeAi(FABRICATING_JSON);
    const handler = new CampaignReportAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);

    await handler.onCampaignEnded({ tenantId: 't1', payload: { campaignId: '' } } as never);

    expect(skillRun.start).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });
});

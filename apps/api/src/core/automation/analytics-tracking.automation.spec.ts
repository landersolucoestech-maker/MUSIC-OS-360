import 'reflect-metadata';
import { AnalyticsTrackingAutomation } from './analytics-tracking.automation';

function makeSkillRun(recentSuccess: unknown = null) {
  return {
    start: jest.fn(async () => 'run-1'),
    succeed: jest.fn(async () => undefined),
    fail: jest.fn(async () => undefined),
    findRecentSuccess: jest.fn(async () => recentSuccess),
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

function makePostHog(configured: boolean) {
  return { isConfigured: jest.fn(() => configured) };
}

const VALID_JSON = JSON.stringify({
  coverageSummary: 'Cobertura baixa — apenas 2 eventos de negócio têm rastreamento real.',
  gaps: [{ gap: 'Maioria dos eventos de negócio não é rastreada no provedor', severity: 'medium' }],
  recommendations: [{ recommendation: 'Adicionar rastreamento para lead.converted', businessEvent: 'lead.converted' }],
});

describe('AnalyticsTrackingAutomation (ON_DEMAND: POST /analytics/tracking-coverage)', () => {
  it('cruza o registro real de DOMAIN_EVENTS contra os métodos reais de PostHogService', async () => {
    const skillRun = makeSkillRun();
    const ai = makeAi(VALID_JSON);
    const postHog = makePostHog(true);
    const handler = new AnalyticsTrackingAutomation(skillRun as never, ai as never, postHog as never);

    const result = await handler.run('t1', 'u1');

    const aiCalls = ai.complete.mock.calls as unknown as Array<[{ prompt: string }]>;
    expect(aiCalls[0][0].prompt).toContain('Provedor de analytics: PostHog (estado: configured)');
    expect(aiCalls[0][0].prompt).toContain('contract.signed (via trackContractSigned)');
    expect(aiCalls[0][0].prompt).toContain('release.created (via trackReleaseCreated)');

    // ANTI-FABRICAÇÃO: coveragePercentage é sempre derivado do cruzamento real, nunca do modelo.
    expect(result.parsed.coveragePercentage).toBeGreaterThan(0);
    expect(result.parsed.coveragePercentage).toBeLessThan(5); // só 2 de ~100 eventos têm tracking real
    expect(skillRun.succeed).toHaveBeenCalled();
  });

  it('provedor não configurado: reporta configuration_required de forma verdadeira', async () => {
    const skillRun = makeSkillRun();
    const ai = makeAi(VALID_JSON);
    const postHog = makePostHog(false);
    const handler = new AnalyticsTrackingAutomation(skillRun as never, ai as never, postHog as never);

    await handler.run('t1', 'u1');

    const aiCalls = ai.complete.mock.calls as unknown as Array<[{ prompt: string }]>;
    expect(aiCalls[0][0].prompt).toContain('estado: configuration_required');
  });

  it('reaproveita auditoria recente (stale-refresh de 1 dia) sem nova chamada de IA', async () => {
    const cachedRun = {
      id: 'run-old',
      finished_at: new Date().toISOString(),
      output_payload: { provider: 'openai', model: 'gpt-4o-mini', generatedAt: '2026-01-01T00:00:00Z', parsed: { coveragePercentage: 2 } },
    };
    const skillRun = makeSkillRun(cachedRun);
    const ai = makeAi(VALID_JSON);
    const postHog = makePostHog(true);
    const handler = new AnalyticsTrackingAutomation(skillRun as never, ai as never, postHog as never);

    const result = await handler.run('t1', 'u1');

    expect(result.fromCache).toBe(true);
    expect(ai.complete).not.toHaveBeenCalled();
  });

  it('falha da IA registra fail e relança', async () => {
    const skillRun = makeSkillRun();
    const ai = makeFailingAi();
    const postHog = makePostHog(true);
    const handler = new AnalyticsTrackingAutomation(skillRun as never, ai as never, postHog as never);

    await expect(handler.run('t1', 'u1')).rejects.toThrow('Nenhum provider de AI configurado');
    expect(skillRun.fail).toHaveBeenCalledWith('run-1', 't1', 'analytics-tracking', expect.any(Error));
  });
});

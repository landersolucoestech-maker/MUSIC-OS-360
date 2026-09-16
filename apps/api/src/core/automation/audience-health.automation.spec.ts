import 'reflect-metadata';
import { AudienceHealthAutomation } from './audience-health.automation';

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

const CAREER_STAGE_RESULT = {
  status: 'OK' as const,
  score: 6.4,
  classification: 'Crescimento',
  confidence: 80,
  coverage: 0.9,
  dimensions: [],
  positiveFactors: [{ dimension: 'reach', reason: 'Crescimento consistente de seguidores', metrics: [], evidence: [] }],
  bottlenecks: [{ dimension: 'engagement', reason: 'Baixo engajamento no TikTok', metrics: [], evidence: [] }],
  engineVersion: 'v1',
  calculatedAt: new Date('2026-01-01T00:00:00Z'),
  freshness: 'FRESH' as const,
};

const MARKET_BENCHMARK_RESULT = {
  readStatus: 'READY' as const,
  result: { status: 'OK', score: 55.2, label: 'Acima da média do gênero' },
  staleSince: null,
};

function makeCareerStage() {
  return { calculate: jest.fn(async () => CAREER_STAGE_RESULT) };
}

function makeMarketBenchmark(result: unknown = MARKET_BENCHMARK_RESULT) {
  return { getStatus: jest.fn(async () => result) };
}

const VALID_JSON = JSON.stringify({
  healthSummary: 'Artista em crescimento consistente com atenção necessária no TikTok.',
  healthStatus: 'attention',
  strengths: [{ strength: 'Crescimento de seguidores', evidence: 'Career Stage: fatores positivos' }],
  concerns: [{ concern: 'Baixo engajamento no TikTok', severity: 'medium', evidence: 'Career Stage: gargalos' }],
  recommendedActions: [{ action: 'Investir em conteúdo nativo de TikTok', priority: 'high' }],
  dataGaps: [],
});

describe('AudienceHealthAutomation (ON_DEMAND: POST /artists/:id/audience-health)', () => {
  it('sintetiza career-stage + market-benchmark reais, registra skill_run e retorna o resultado', async () => {
    const skillRun = makeSkillRun();
    const ai = makeAi(VALID_JSON);
    const careerStage = makeCareerStage();
    const marketBenchmark = makeMarketBenchmark();
    const handler = new AudienceHealthAutomation(skillRun as never, ai as never, careerStage as never, marketBenchmark as never);

    const result = await handler.run('t1', 'u1', 'a1', 'Banda Aurora', false);

    expect(careerStage.calculate).toHaveBeenCalledWith('t1', 'a1');
    expect(marketBenchmark.getStatus).toHaveBeenCalledWith('t1', 'a1');
    expect(skillRun.start).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 't1', userId: 'u1', skillName: 'audience-health', entityType: 'artist', entityId: 'a1' }),
    );

    const aiCalls = ai.complete.mock.calls as unknown as Array<[{ prompt: string; jsonMode: boolean }]>;
    expect(aiCalls[0][0].jsonMode).toBe(true);
    expect(aiCalls[0][0].prompt).toContain('Banda Aurora');
    expect(aiCalls[0][0].prompt).toContain('Crescimento consistente de seguidores');
    expect(aiCalls[0][0].prompt).toContain('Baixo engajamento no TikTok');
    expect(aiCalls[0][0].prompt).toContain('READY');

    expect(result.fromCache).toBe(false);
    expect(result.parsed.healthStatus).toBe('attention');
    expect(skillRun.succeed).toHaveBeenCalled();
  });

  it('reaproveita síntese recente (stale-refresh) sem nova chamada de IA', async () => {
    const cachedRun = {
      id: 'run-old',
      finished_at: new Date().toISOString(),
      output_payload: { provider: 'openai', model: 'gpt-4o-mini', generatedAt: '2026-01-01T00:00:00Z', parsed: { healthStatus: 'healthy' } },
    };
    const skillRun = makeSkillRun(cachedRun);
    const ai = makeAi(VALID_JSON);
    const careerStage = makeCareerStage();
    const marketBenchmark = makeMarketBenchmark();
    const handler = new AudienceHealthAutomation(skillRun as never, ai as never, careerStage as never, marketBenchmark as never);

    const result = await handler.run('t1', 'u1', 'a1', 'Banda Aurora', false);

    expect(result.fromCache).toBe(true);
    expect((result.parsed as { healthStatus: string }).healthStatus).toBe('healthy');
    expect(ai.complete).not.toHaveBeenCalled();
    expect(skillRun.start).not.toHaveBeenCalled();
  });

  it('forceRefresh ignora o cache e gera novamente', async () => {
    const cachedRun = {
      id: 'run-old',
      finished_at: new Date().toISOString(),
      output_payload: { provider: 'openai', model: 'gpt-4o-mini', generatedAt: '2026-01-01T00:00:00Z', parsed: { healthStatus: 'healthy' } },
    };
    const skillRun = makeSkillRun(cachedRun);
    const ai = makeAi(VALID_JSON);
    const careerStage = makeCareerStage();
    const marketBenchmark = makeMarketBenchmark();
    const handler = new AudienceHealthAutomation(skillRun as never, ai as never, careerStage as never, marketBenchmark as never);

    const result = await handler.run('t1', 'u1', 'a1', 'Banda Aurora', true);

    expect(result.fromCache).toBe(false);
    expect(ai.complete).toHaveBeenCalled();
  });

  it('Market Benchmark indisponível: sinaliza no prompt, sem inventar score', async () => {
    const skillRun = makeSkillRun();
    const ai = makeAi(VALID_JSON);
    const careerStage = makeCareerStage();
    const marketBenchmark = makeMarketBenchmark({ readStatus: 'INTEGRATION_UNAVAILABLE', result: null, staleSince: null });
    const handler = new AudienceHealthAutomation(skillRun as never, ai as never, careerStage as never, marketBenchmark as never);

    await handler.run('t1', 'u1', 'a1', 'Banda Aurora', false);

    const aiCalls = ai.complete.mock.calls as unknown as Array<[{ prompt: string }]>;
    expect(aiCalls[0][0].prompt).toContain('INTEGRATION_UNAVAILABLE');
    expect(aiCalls[0][0].prompt).not.toMatch(/marketBenchmarkScore|label=/);
  });

  it('falha da IA registra fail e relança (síncrono — o controller decide o erro HTTP)', async () => {
    const skillRun = makeSkillRun();
    const ai = makeFailingAi();
    const careerStage = makeCareerStage();
    const marketBenchmark = makeMarketBenchmark();
    const handler = new AudienceHealthAutomation(skillRun as never, ai as never, careerStage as never, marketBenchmark as never);

    await expect(handler.run('t1', 'u1', 'a1', 'Banda Aurora', false)).rejects.toThrow('Nenhum provider de AI configurado');

    expect(skillRun.fail).toHaveBeenCalledWith('run-1', 't1', 'audience-health', expect.any(Error));
    expect(skillRun.succeed).not.toHaveBeenCalled();
  });
});

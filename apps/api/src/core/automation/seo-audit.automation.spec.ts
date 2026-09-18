import 'reflect-metadata';
import { SeoAuditAutomation } from './seo-audit.automation';

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

const STORED_CAMPAIGN = {
  id: 'camp-1',
  tenantId: 't1',
  name: 'Lançamento Single Verão — Ads',
  promotedEntityType: 'RELEASE',
  promotedEntityName: 'Verão Eterno',
  destinationUrl: 'https://smartlink.example/verao-eterno',
  utm: { utmSource: 'instagram' },
};

function makeCampaignBuilder(campaign: unknown = STORED_CAMPAIGN) {
  return { find: jest.fn(async () => campaign) };
}

const VALID_JSON = JSON.stringify({
  auditSummary: 'Link de destino configurado com HTTPS e UTM presente.',
  checks: [
    { subject: 'Lançamento Single Verão — Ads', source: 'static_analysis', check: 'URL de destino configurada', evidence: 'https://smartlink.example/verao-eterno', result: 'presente', severity: 'info', recommendation: '', metricProvenance: 'actual' },
  ],
  unavailableMetrics: ['ranking de busca', 'tráfego orgânico'],
});

describe('SeoAuditAutomation (ON_DEMAND+STALE_REFRESH: POST .../ai/seo-audit)', () => {
  it('audita apenas com dados reais já conhecidos, nunca faz fetch HTTP externo', async () => {
    const skillRun = makeSkillRun();
    const ai = makeAi(VALID_JSON);
    const campaignBuilder = makeCampaignBuilder();
    const handler = new SeoAuditAutomation(skillRun as never, ai as never, campaignBuilder as never);

    const result = await handler.run('t1', 'u1', 'camp-1', false);

    const aiCalls = ai.complete.mock.calls as unknown as Array<[{ prompt: string }]>;
    expect(aiCalls[0][0].prompt).toContain('smartlink.example');
    expect(aiCalls[0][0].prompt).toContain('Rastreamento UTM configurado: sim');
    expect(result.parsed.checks.every((c) => c.source === 'static_analysis')).toBe(true);
    expect(result.parsed.unavailableMetrics).toEqual(expect.arrayContaining(['ranking de busca']));
  });

  it('ANTI-FABRICAÇÃO: descarta qualquer check marcado como external_measurement pelo provider', async () => {
    const withExternal = JSON.stringify({
      auditSummary: 'x',
      checks: [
        { subject: 'x', source: 'external_measurement', check: 'ranking no Google', evidence: 'posição 3', result: 'bom', severity: 'info', recommendation: '', metricProvenance: 'actual' },
        { subject: 'x', source: 'static_analysis', check: 'URL configurada', evidence: 'sim', result: 'presente', severity: 'info', recommendation: '', metricProvenance: 'actual' },
      ],
      unavailableMetrics: [],
    });
    const skillRun = makeSkillRun();
    const ai = makeAi(withExternal);
    const campaignBuilder = makeCampaignBuilder();
    const handler = new SeoAuditAutomation(skillRun as never, ai as never, campaignBuilder as never);

    const result = await handler.run('t1', 'u1', 'camp-1', false);

    expect(result.parsed.checks).toHaveLength(1);
    expect(result.parsed.checks[0].check).toBe('URL configurada');
    expect(result.parsed.unavailableMetrics).toEqual(expect.arrayContaining(['ranking de busca', 'Core Web Vitals']));
  });

  it('sem destinationUrl: monta input sem essa evidência', async () => {
    const row = { ...STORED_CAMPAIGN, destinationUrl: undefined, utm: undefined };
    const skillRun = makeSkillRun();
    const ai = makeAi(VALID_JSON);
    const campaignBuilder = makeCampaignBuilder(row);
    const handler = new SeoAuditAutomation(skillRun as never, ai as never, campaignBuilder as never);

    await handler.run('t1', 'u1', 'camp-1', false);

    const aiCalls = ai.complete.mock.calls as unknown as Array<[{ prompt: string }]>;
    expect(aiCalls[0][0].prompt).toContain('Nenhuma URL de destino configurada');
  });

  it('reaproveita auditoria recente (stale-refresh de 7 dias) sem nova chamada de IA', async () => {
    const cachedRun = {
      id: 'run-old',
      finished_at: new Date().toISOString(),
      output_payload: { provider: 'openai', model: 'gpt-4o-mini', generatedAt: '2026-01-01T00:00:00Z', parsed: { auditSummary: 'cached' } },
    };
    const skillRun = makeSkillRun(cachedRun);
    const ai = makeAi(VALID_JSON);
    const campaignBuilder = makeCampaignBuilder();
    const handler = new SeoAuditAutomation(skillRun as never, ai as never, campaignBuilder as never);

    const result = await handler.run('t1', 'u1', 'camp-1', false);

    expect(result.fromCache).toBe(true);
    expect(ai.complete).not.toHaveBeenCalled();
  });

  it('falha da IA registra fail e relança', async () => {
    const skillRun = makeSkillRun();
    const ai = makeFailingAi();
    const campaignBuilder = makeCampaignBuilder();
    const handler = new SeoAuditAutomation(skillRun as never, ai as never, campaignBuilder as never);

    await expect(handler.run('t1', 'u1', 'camp-1', false)).rejects.toThrow('Nenhum provider de AI configurado');
    expect(skillRun.fail).toHaveBeenCalledWith('run-1', 't1', 'seo-audit', expect.any(Error));
  });
});

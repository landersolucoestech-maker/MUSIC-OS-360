import 'reflect-metadata';
import { CampaignBuilderInsightsAutomation } from './campaign-builder-insights.automation';

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

const STORED_CAMPAIGN = {
  id: 'camp-1',
  tenantId: 't1',
  name: 'Lançamento Single Verão — Ads',
  objective: 'CONVERSIONS',
  expectedOutcome: 'PRE_SAVE',
  promotedEntityType: 'RELEASE',
  promotedEntityName: 'Verão Eterno',
  platforms: ['META_ADS', 'GOOGLE_ADS'],
  placements: ['META_STORIES', 'GOOGLE_SEARCH'],
  destinationUrl: 'https://smartlink.example/verao-eterno',
  totalBudget: 5000,
  dailyBudget: null,
  audience: { countries: 'BR', ageMin: 18, ageMax: 34 },
  status: 'DRAFT',
  validation: { valid: true, errors: [], warnings: [] },
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

function makeCampaignBuilder(campaign: unknown = STORED_CAMPAIGN) {
  return { find: jest.fn(async () => campaign) };
}

const AD_CREATIVE_JSON = JSON.stringify({
  creativeSummary: 'Foco em expectativa de pré-save com tom animado.',
  variants: [
    { headline: 'Pré-save já disponível', primaryCopy: 'Não perca o lançamento de Verão Eterno.', description: 'Salve agora.', cta: 'Fazer pre-save', tone: 'direto' },
  ],
  platformNotes: 'Meta Stories: usar formato vertical 9:16.',
  risks: [{ risk: 'Headline pode cortar em telas pequenas', severity: 'low' }],
});

const PAID_ADS_JSON = JSON.stringify({
  strategySummary: 'Concentrar orçamento em Meta Ads pela afinidade de público jovem.',
  platformSplit: [
    { platform: 'META_ADS', percentageShare: 70, rationale: 'Maior afinidade com o público-alvo' },
    { platform: 'GOOGLE_ADS', percentageShare: 30, rationale: 'Captura de busca intencional' },
  ],
  placementRecommendations: [
    { platform: 'META_ADS', placement: 'META_STORIES', rationale: 'Alto engajamento de público jovem' },
    { platform: 'GOOGLE_ADS', placement: 'GOOGLE_SEARCH', rationale: 'Captura de intenção de busca' },
  ],
  budgetNotes: 'Orçamento total de R$5000 concentrado nas duas primeiras semanas.',
  risks: [],
});

describe('CampaignBuilderInsightsAutomation.runAdCreative (ON_DEMAND: POST .../ai/ad-creative)', () => {
  it('carrega a campanha real, valida a plataforma selecionada e retorna sugestões de criativo', async () => {
    const skillRun = makeSkillRun();
    const ai = makeAi(AD_CREATIVE_JSON);
    const campaignBuilder = makeCampaignBuilder();
    const handler = new CampaignBuilderInsightsAutomation(skillRun as never, ai as never, campaignBuilder as never);

    const result = await handler.runAdCreative('t1', 'u1', 'camp-1', 'META_ADS', 'META_STORIES');

    expect(campaignBuilder.find).toHaveBeenCalledWith('t1', 'camp-1');
    expect(skillRun.start).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 't1', userId: 'u1', skillName: 'ad-creative', entityType: 'marketing_builder_campaign', entityId: 'camp-1' }),
    );

    const aiCalls = ai.complete.mock.calls as unknown as Array<[{ prompt: string }]>;
    expect(aiCalls[0][0].prompt).toContain('Verão Eterno');
    expect(aiCalls[0][0].prompt).toContain('META_ADS');
    expect(aiCalls[0][0].prompt).toContain('META_STORIES');
    expect(aiCalls[0][0].prompt).toContain('smartlink.example');

    expect(result.parsed.variants).toHaveLength(1);
    expect(skillRun.succeed).toHaveBeenCalled();
  });

  it('rejeita uma plataforma que não está selecionada na campanha', async () => {
    const skillRun = makeSkillRun();
    const ai = makeAi(AD_CREATIVE_JSON);
    const campaignBuilder = makeCampaignBuilder();
    const handler = new CampaignBuilderInsightsAutomation(skillRun as never, ai as never, campaignBuilder as never);

    await expect(handler.runAdCreative('t1', 'u1', 'camp-1', 'TIKTOK_ADS', 'TIKTOK_FOR_YOU')).rejects.toThrow(
      /não está selecionada/,
    );
    expect(ai.complete).not.toHaveBeenCalled();
    expect(skillRun.start).not.toHaveBeenCalled();
  });

  it('falha da IA registra fail e relança', async () => {
    const skillRun = makeSkillRun();
    const ai = makeFailingAi();
    const campaignBuilder = makeCampaignBuilder();
    const handler = new CampaignBuilderInsightsAutomation(skillRun as never, ai as never, campaignBuilder as never);

    await expect(handler.runAdCreative('t1', 'u1', 'camp-1', 'META_ADS', 'META_STORIES')).rejects.toThrow('Nenhum provider de AI configurado');
    expect(skillRun.fail).toHaveBeenCalledWith('run-1', 't1', 'ad-creative', expect.any(Error));
  });
});

describe('CampaignBuilderInsightsAutomation.runPaidAdsStrategy (ON_DEMAND: POST .../ai/paid-ads-strategy)', () => {
  it('sugere alocação de orçamento entre as plataformas reais selecionadas, somando 100%', async () => {
    const skillRun = makeSkillRun();
    const ai = makeAi(PAID_ADS_JSON);
    const campaignBuilder = makeCampaignBuilder();
    const handler = new CampaignBuilderInsightsAutomation(skillRun as never, ai as never, campaignBuilder as never);

    const result = await handler.runPaidAdsStrategy('t1', 'u1', 'camp-1');

    const aiCalls = ai.complete.mock.calls as unknown as Array<[{ prompt: string }]>;
    expect(aiCalls[0][0].prompt).toContain('META_ADS');
    expect(aiCalls[0][0].prompt).toContain('GOOGLE_ADS');
    // posicionamentos compatíveis restritos aos já selecionados na campanha (META_STORIES/GOOGLE_SEARCH)
    expect(aiCalls[0][0].prompt).toContain('META_STORIES');
    expect(aiCalls[0][0].prompt).not.toContain('META_REELS');

    const sum = result.parsed.platformSplit.reduce((acc, p) => acc + p.percentageShare, 0);
    expect(sum).toBe(100);
  });

  it('rejeita quando nenhuma plataforma foi selecionada ainda', async () => {
    const skillRun = makeSkillRun();
    const ai = makeAi(PAID_ADS_JSON);
    const campaignBuilder = makeCampaignBuilder({ ...STORED_CAMPAIGN, platforms: [] });
    const handler = new CampaignBuilderInsightsAutomation(skillRun as never, ai as never, campaignBuilder as never);

    await expect(handler.runPaidAdsStrategy('t1', 'u1', 'camp-1')).rejects.toThrow(/Selecione ao menos uma plataforma/);
    expect(ai.complete).not.toHaveBeenCalled();
  });

  it('falha da IA registra fail e relança', async () => {
    const skillRun = makeSkillRun();
    const ai = makeFailingAi();
    const campaignBuilder = makeCampaignBuilder();
    const handler = new CampaignBuilderInsightsAutomation(skillRun as never, ai as never, campaignBuilder as never);

    await expect(handler.runPaidAdsStrategy('t1', 'u1', 'camp-1')).rejects.toThrow('Nenhum provider de AI configurado');
    expect(skillRun.fail).toHaveBeenCalledWith('run-1', 't1', 'paid-ads', expect.any(Error));
  });
});

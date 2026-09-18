/**
 * core/automation/campaign-builder-insights.automation.ts
 *
 * Duas skills ON_DEMAND (ver on-demand-skill.runner.ts) sobre a campanha REAL
 * já em rascunho no Campaign Builder (MarketingCampaignBuilderService,
 * CampaignEntity com type='marketing_builder') — nunca lançam/gerenciam
 * anúncios reais, apenas geram sugestões de texto/alocação que o usuário
 * revisa e aplica manualmente na UI existente:
 *
 *   ad-creative → sugestões de headline/copy/descrição/CTA para UMA
 *                 plataforma+posicionamento específicos da campanha.
 *   paid-ads    → sugestão de alocação percentual de orçamento entre as
 *                 plataformas já selecionadas + posicionamentos prioritários
 *                 (usa o mesmo campaignBuilderConfig que o próprio
 *                 controller do Campaign Builder usa para validação — nunca
 *                 inventa um posicionamento incompatível).
 *
 * Nenhuma das duas lê/escreve `metrics`/`estimateCampaignResults()` — ver
 * docs/CODEBASE_MAP.md: esse campo já fabrica desempenho e é exibido como
 * real (achado pré-existente, fora do escopo desta automação). Nenhuma
 * escreve o resultado de volta na campanha automaticamente.
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { SkillRunService } from '../skills/skill-run.service';
import { AIService } from '../../modules/ai/ai.service';
import { MarketingCampaignBuilderService } from '../../modules/marketing/marketing-campaign-builder.service';
import { campaignBuilderConfig } from '../../modules/marketing/campaign-builder.config';
import {
  AD_CREATIVE_SYSTEM_PROMPT,
  buildAdCreativePrompt,
  parseAdCreativeResponse,
  validateAdCreativeInput,
  type AdCreativeInput,
  type AdCreativeOutput,
  PAID_ADS_SYSTEM_PROMPT,
  buildPaidAdsPrompt,
  parsePaidAdsResponse,
  validatePaidAdsInput,
  type PaidAdsInput,
  type PaidAdsOutput,
  type PaidAdsPlatformInput,
} from '@music-os-360/ai-skills';
import { runOnDemandSkill, type OnDemandSkillResult } from './on-demand-skill.runner';

const AD_CREATIVE_SKILL_NAME = 'ad-creative';
const PAID_ADS_SKILL_NAME = 'paid-ads';

type PlatformConfig = { objectives: string[]; placements: string[]; creatives: string[] };

function audienceSummary(audience: Record<string, unknown> | undefined): string | undefined {
  if (!audience) return undefined;
  const parts = Object.entries(audience)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}=${String(v)}`);
  return parts.length > 0 ? parts.join(', ') : undefined;
}

@Injectable()
export class CampaignBuilderInsightsAutomation {
  constructor(
    private readonly skillRun: SkillRunService,
    private readonly ai: AIService,
    private readonly campaignBuilder: MarketingCampaignBuilderService,
  ) {}

  async runAdCreative(
    tenantId: string,
    userId: string,
    campaignId: string,
    platform: string,
    placement: string,
  ): Promise<OnDemandSkillResult<AdCreativeOutput>> {
    const campaign = await this.campaignBuilder.find(tenantId, campaignId);

    if (!(campaign.platforms ?? []).includes(platform)) {
      throw new NotFoundException(`Plataforma "${platform}" não está selecionada nesta campanha`);
    }

    const input: AdCreativeInput = {
      campaignName: campaign.name?.trim() || 'Campanha',
      objective: campaign.objective ?? 'REACH',
      promotedEntityType: campaign.promotedEntityType ?? 'OTHER',
      promotedEntityName: campaign.promotedEntityName?.trim() || 'Entidade promovida',
      platform,
      placement,
      language: 'pt-BR',
    };
    if (campaign.expectedOutcome) input.expectedOutcome = campaign.expectedOutcome;
    if (campaign.destinationUrl) input.destinationUrl = campaign.destinationUrl;
    const audience = audienceSummary(campaign.audience);
    if (audience) input.audienceSummary = audience;

    return runOnDemandSkill<AdCreativeInput, AdCreativeOutput>(
      { skillRun: this.skillRun, ai: this.ai },
      {
        skillName: AD_CREATIVE_SKILL_NAME,
        tenantId,
        userId,
        entityType: 'marketing_builder_campaign',
        entityId: campaignId,
        systemPrompt: AD_CREATIVE_SYSTEM_PROMPT,
        input,
        buildPrompt: buildAdCreativePrompt,
        parseResponse: parseAdCreativeResponse,
        validateInput: validateAdCreativeInput,
      },
    );
  }

  async runPaidAdsStrategy(
    tenantId: string,
    userId: string,
    campaignId: string,
  ): Promise<OnDemandSkillResult<PaidAdsOutput>> {
    const campaign = await this.campaignBuilder.find(tenantId, campaignId);
    const selectedPlatforms = campaign.platforms ?? [];
    if (selectedPlatforms.length === 0) {
      throw new NotFoundException('Selecione ao menos uma plataforma antes de gerar a estratégia de orçamento');
    }

    const platformMap = campaignBuilderConfig.platforms as Record<string, PlatformConfig>;
    const selectedPlacements = new Set(campaign.placements ?? []);
    const platforms: PaidAdsPlatformInput[] = selectedPlatforms.map((platform) => {
      const compatible = platformMap[platform]?.placements ?? [];
      const scoped = selectedPlacements.size > 0 ? compatible.filter((p) => selectedPlacements.has(p)) : compatible;
      return { platform, compatiblePlacements: scoped.length > 0 ? scoped : compatible };
    });

    const input: PaidAdsInput = {
      campaignName: campaign.name?.trim() || 'Campanha',
      objective: campaign.objective ?? 'REACH',
      promotedEntityType: campaign.promotedEntityType ?? 'OTHER',
      promotedEntityName: campaign.promotedEntityName?.trim() || 'Entidade promovida',
      platforms,
      language: 'pt-BR',
    };
    if (campaign.expectedOutcome) input.expectedOutcome = campaign.expectedOutcome;
    if (campaign.totalBudget != null) input.totalBudget = campaign.totalBudget;
    if (campaign.dailyBudget != null) input.dailyBudget = campaign.dailyBudget;
    const audience = audienceSummary(campaign.audience);
    if (audience) input.audienceSummary = audience;

    return runOnDemandSkill<PaidAdsInput, PaidAdsOutput>(
      { skillRun: this.skillRun, ai: this.ai },
      {
        skillName: PAID_ADS_SKILL_NAME,
        tenantId,
        userId,
        entityType: 'marketing_builder_campaign',
        entityId: campaignId,
        systemPrompt: PAID_ADS_SYSTEM_PROMPT,
        input,
        buildPrompt: buildPaidAdsPrompt,
        parseResponse: parsePaidAdsResponse,
        validateInput: validatePaidAdsInput,
      },
    );
  }
}

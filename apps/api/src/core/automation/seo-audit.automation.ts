/**
 * core/automation/seo-audit.automation.ts
 *
 * ON_DEMAND + STALE_REFRESH skill (see on-demand-skill.runner.ts): audits the
 * link hygiene of a real Campaign Builder campaign
 * (MarketingCampaignBuilderService/CampaignEntity type='marketing_builder')
 * — STATIC_ANALYSIS only, over already known fields (destinationUrl,
 * utm, name of the promoted entity). NEVER makes an HTTP fetch of the destinationUrl
 * (see contracts.ts for the security rationale — deliberate absence of a
 * general-purpose anti-SSRF guard in this code).
 */

import { Injectable } from '@nestjs/common';
import { SkillRunService } from '../skills/skill-run.service';
import { AiService } from '../../modules/ai/ai.service';
import { MarketingCampaignBuilderService } from '../../modules/marketing/marketing-campaign-builder.service';
import {
  SEO_AUDIT_SYSTEM_PROMPT,
  buildSeoAuditPrompt,
  parseSeoAuditResponse,
  validateSeoAuditInput,
  type SeoAuditInput,
  type SeoAuditOutput,
} from '@music-os-360/ai-skills';
import { runOnDemandSkill, type OnDemandSkillResult } from './on-demand-skill.runner';

const SKILL_NAME = 'seo-audit';
const SEO_AUDIT_FRESHNESS_MINUTES = 7 * 24 * 60; // 7 dias

@Injectable()
export class SeoAuditAutomation {
  constructor(
    private readonly skillRun: SkillRunService,
    private readonly ai: AiService,
    private readonly campaignBuilder: MarketingCampaignBuilderService,
  ) {}

  async run(
    tenantId: string,
    userId: string,
    campaignId: string,
    forceRefresh: boolean,
  ): Promise<OnDemandSkillResult<SeoAuditOutput>> {
    const campaign = await this.campaignBuilder.find(tenantId, campaignId);

    const input: SeoAuditInput = {
      campaignName: campaign.name?.trim() || 'Campanha',
      promotedEntityType: campaign.promotedEntityType ?? 'OTHER',
      promotedEntityName: campaign.promotedEntityName?.trim() || 'Entidade promovida',
      hasUtm: !!campaign.utm && Object.keys(campaign.utm).length > 0,
      language: 'pt-BR',
    };
    if (campaign.destinationUrl) input.destinationUrl = campaign.destinationUrl;

    return runOnDemandSkill<SeoAuditInput, SeoAuditOutput>(
      { skillRun: this.skillRun, ai: this.ai },
      {
        skillName: SKILL_NAME,
        tenantId,
        userId,
        entityType: 'marketing_builder_campaign',
        entityId: campaignId,
        systemPrompt: SEO_AUDIT_SYSTEM_PROMPT,
        input,
        buildPrompt: buildSeoAuditPrompt,
        parseResponse: parseSeoAuditResponse,
        validateInput: validateSeoAuditInput,
        freshnessMinutes: SEO_AUDIT_FRESHNESS_MINUTES,
        forceRefresh,
      },
    );
  }
}

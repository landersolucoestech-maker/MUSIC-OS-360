/**
 * core/automation/automation.module.ts
 *
 * Automações NATIVAS internas orientadas a eventos (event-driven).
 * Registra handlers @OnEvent que executam AI Skills automaticamente.
 *
 * Fatia atual:
 *   project.completed      → project-planning
 *   release.created        → release-checklist
 *   support.ticket.created → support-triage
 *   artist.created         → artist-profile-analysis
 *   catalog.work.created / catalog.recording.created → catalog-metadata-validator
 *   transaction.created    → financial-classification
 *   lead.created           → crm-followup
 *   release.approved       → marketing-calendar-builder
 *   release.approved       → audiovisual-briefing
 *   campaign.created       → campaign-plan
 *   campaign.started       → campaign-strategy
 *   campaign.ended         → campaign-report
 *   marketing.content_created → social-content
 * SkillRunService (auditoria/idempotência) vem do SkillsModule (@Global);
 * EventsService/DATA_SOURCE vêm de módulos @Global. AIService vem do AIModule.
 *
 * Não expõe controller, rota, configuração nem nada ao usuário final.
 */

import { Module } from '@nestjs/common';
import { AIModule } from '../../modules/ai/ai.module';
import { ProjectPlanningAutomation } from './project-planning.automation';
import { ReleaseChecklistAutomation } from './release-checklist.automation';
import { SupportTriageAutomation } from './support-triage.automation';
import { ArtistProfileAnalysisAutomation } from './artist-profile-analysis.automation';
import { CatalogMetadataValidatorAutomation } from './catalog-metadata-validator.automation';
import { FinancialClassificationAutomation } from './financial-classification.automation';
import { CrmFollowupAutomation } from './crm-followup.automation';
import { MarketingCalendarBuilderAutomation } from './marketing-calendar-builder.automation';
import { AudiovisualBriefingAutomation } from './audiovisual-briefing.automation';
import { CampaignPlanAutomation } from './campaign-plan.automation';
import { CampaignStrategyAutomation } from './campaign-strategy.automation';
import { CampaignReportAutomation } from './campaign-report.automation';
import { SocialContentAutomation } from './social-content.automation';

@Module({
  imports: [AIModule],
  providers: [
    ProjectPlanningAutomation,
    ReleaseChecklistAutomation,
    SupportTriageAutomation,
    ArtistProfileAnalysisAutomation,
    CatalogMetadataValidatorAutomation,
    FinancialClassificationAutomation,
    CrmFollowupAutomation,
    MarketingCalendarBuilderAutomation,
    AudiovisualBriefingAutomation,
    CampaignPlanAutomation,
    CampaignStrategyAutomation,
    CampaignReportAutomation,
    SocialContentAutomation,
  ],
})
export class AutomationModule {}

/**
 * core/automation/automation.module.ts
 *
 * Internal NATIVE event-driven automations.
 * Registers @OnEvent handlers that run AI Skills automatically.
 *
 * Current slice:
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
 *   release.approved       → launch-strategy (3rd non-overlapping skill on this event)
 *   client.created          → contact-operations
 * SkillRunService (auditing/idempotency) comes from SkillsModule (@Global);
 * EventsService/DATA_SOURCE come from @Global modules. AIService comes from AIModule.
 *
 * Exposes no controller, route, configuration or anything else to the end user.
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
import { LaunchStrategyAutomation } from './launch-strategy.automation';
import { ContactOperationsAutomation } from './contact-operations.automation';

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
    LaunchStrategyAutomation,
    ContactOperationsAutomation,
  ],
})
export class AutomationModule {}

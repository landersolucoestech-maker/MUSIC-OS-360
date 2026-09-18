import { Module } from '@nestjs/common';
import { MarketingProjectsController } from './marketing-projects.controller';
import { MarketingProjectsService } from './marketing-projects.service';
import { MarketingProjectEventsHandler } from './handlers/marketing-project-events.handler';
import { MarketingStrategyController } from './marketing-strategy.controller';
import { MarketingStrategyService } from './marketing-strategy.service';
import { MarketingAssetsController } from './marketing-assets.controller';
import { MarketingAssetsService } from './marketing-assets.service';
import { MarketingContentsController } from './marketing-contents.controller';
import { MarketingContentsService } from './marketing-contents.service';
import { CampaignBuilderController } from './campaign-builder.controller';
import { MarketingCampaignBuilderController } from './marketing-campaign-builder.controller';
import { MarketingTasksController } from './marketing-tasks.controller';
import { MarketingTasksService } from './marketing-tasks.service';
import { MarketingCampaignBuilderService } from './marketing-campaign-builder.service';
import { MarketingAiSuggestionsController } from './marketing-ai-suggestions.controller';
import { MarketingAiSuggestionsService } from './marketing-ai-suggestions.service';
import { AIModule } from '../ai/ai.module';
import { CampaignBuilderInsightsAutomation } from '../../core/automation/campaign-builder-insights.automation';

@Module({
  imports: [AIModule],
  controllers: [
    MarketingProjectsController,
    MarketingStrategyController,
    MarketingAssetsController,
    MarketingContentsController,
    CampaignBuilderController,
    MarketingCampaignBuilderController,
    MarketingTasksController,
    MarketingAiSuggestionsController,
  ],
  providers:   [MarketingProjectsService, MarketingStrategyService, MarketingAssetsService, MarketingContentsService, MarketingTasksService, MarketingCampaignBuilderService, MarketingAiSuggestionsService, MarketingProjectEventsHandler, CampaignBuilderInsightsAutomation],
  exports:     [MarketingProjectsService, MarketingStrategyService, MarketingAssetsService, MarketingContentsService, MarketingTasksService],
})
export class MarketingModule {}

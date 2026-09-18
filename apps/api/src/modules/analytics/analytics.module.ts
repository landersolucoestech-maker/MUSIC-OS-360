import { Module } from '@nestjs/common';
import { AnalyticsService }    from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { AIModule } from '../ai/ai.module';
import { AnalyticsInsightsAutomation } from '../../core/automation/analytics-insights.automation';
import { AnalyticsTrackingAutomation } from '../../core/automation/analytics-tracking.automation';

@Module({
  imports:     [AIModule],
  controllers: [AnalyticsController],
  providers:   [AnalyticsService, AnalyticsInsightsAutomation, AnalyticsTrackingAutomation],
  exports:     [AnalyticsService],
})
export class AnalyticsModule {}

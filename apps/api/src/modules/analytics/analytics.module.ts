import { Module } from '@nestjs/common';
import { AnalyticsService }    from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { AIModule } from '../ai/ai.module';
import { AnalyticsInsightsAutomation } from '../../core/automation/analytics-insights.automation';

@Module({
  imports:     [AIModule],
  controllers: [AnalyticsController],
  providers:   [AnalyticsService, AnalyticsInsightsAutomation],
  exports:     [AnalyticsService],
})
export class AnalyticsModule {}

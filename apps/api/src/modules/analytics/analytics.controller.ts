import { Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { CurrentTenant } from '../../core/decorators/current-tenant.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { RequireRole }   from '../../core/decorators/roles.decorator';
import { AnalyticsService } from './analytics.service';
import { AnalyticsInsightsAutomation } from '../../core/automation/analytics-insights.automation';
import { AnalyticsTrackingAutomation } from '../../core/automation/analytics-tracking.automation';

@ApiTags('Analytics') @ApiBearerAuth() @Controller('analytics')
export class AnalyticsController {
  constructor(
    private readonly svc: AnalyticsService,
    private readonly insights: AnalyticsInsightsAutomation,
    private readonly tracking: AnalyticsTrackingAutomation,
  ) {}

  @Get('dashboard')
  @RequireRole('viewer')
  @ApiOperation({ summary: 'Operational dashboard — counters per entity' })
  getDashboard(@CurrentTenant() t: { id: string }) {
    return this.svc.getDashboard(t.id);
  }

  @Get('revenue')
  @RequireRole('viewer')
  @ApiOperation({ summary: 'Monthly revenue and expense overview' })
  @ApiQuery({ name: 'months', required: false, type: Number, description: 'Number of months (default 6)' })
  getRevenue(@CurrentTenant() t: { id: string }, @Query('months') months?: string) {
    return this.svc.getRevenueOverview(t.id, months ? +months : 6);
  }

  @Get('ai-usage')
  @RequireRole('manager')
  @ApiOperation({ summary: 'AI usage per model/feature (cost governance)' })
  @ApiQuery({ name: 'days', required: false, type: Number, description: 'Window in days (default 30)' })
  getAiUsage(@CurrentTenant() t: { id: string }, @Query('days') days?: string) {
    return this.svc.getAiUsageSummary(t.id, days ? +days : 30);
  }

  @Post('reporting-analysis')
  @RequireRole('viewer')
  @ApiOperation({ summary: 'AI Skill reporting-analysis — narrative synthesis of the real operational dashboard' })
  runReportingAnalysis(
    @CurrentTenant() t: { id: string },
    @CurrentUser() user: { userId: string },
    @Query('force') force?: string,
  ) {
    return this.insights.runReportingAnalysis(t.id, user.userId, force === 'true');
  }

  @Post('performance-report')
  @RequireRole('viewer')
  @ApiOperation({ summary: 'AI Skill performance-report — narrative revenue/expense retrospective per period' })
  @ApiQuery({ name: 'months', required: false, type: Number, description: 'Number of months (default 6)' })
  runPerformanceReport(
    @CurrentTenant() t: { id: string },
    @CurrentUser() user: { userId: string },
    @Query('months') months?: string,
  ) {
    return this.insights.runPerformanceReport(t.id, user.userId, months ? +months : 6);
  }

  @Post('tracking-coverage')
  @RequireRole('manager')
  @ApiOperation({ summary: 'AI Skill analytics-tracking — real tracking coverage between business events and the analytics provider' })
  runAnalyticsTracking(
    @CurrentTenant() t: { id: string },
    @CurrentUser() user: { userId: string },
  ) {
    return this.tracking.run(t.id, user.userId);
  }
}

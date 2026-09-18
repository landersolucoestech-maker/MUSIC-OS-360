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
  @ApiOperation({ summary: 'Dashboard operacional — contadores por entidade' })
  getDashboard(@CurrentTenant() t: { id: string }) {
    return this.svc.getDashboard(t.id);
  }

  @Get('revenue')
  @RequireRole('viewer')
  @ApiOperation({ summary: 'Visão geral de receitas e despesas por mês' })
  @ApiQuery({ name: 'months', required: false, type: Number, description: 'Número de meses (default 6)' })
  getRevenue(@CurrentTenant() t: { id: string }, @Query('months') months?: string) {
    return this.svc.getRevenueOverview(t.id, months ? +months : 6);
  }

  @Get('ai-usage')
  @RequireRole('manager')
  @ApiOperation({ summary: 'Consumo de IA por modelo/feature (governança de custos)' })
  @ApiQuery({ name: 'days', required: false, type: Number, description: 'Janela em dias (default 30)' })
  getAiUsage(@CurrentTenant() t: { id: string }, @Query('days') days?: string) {
    return this.svc.getAiUsageSummary(t.id, days ? +days : 30);
  }

  @Post('reporting-analysis')
  @RequireRole('viewer')
  @ApiOperation({ summary: 'AI Skill reporting-analysis — síntese narrativa do dashboard operacional real' })
  runReportingAnalysis(
    @CurrentTenant() t: { id: string },
    @CurrentUser() user: { userId: string },
    @Query('force') force?: string,
  ) {
    return this.insights.runReportingAnalysis(t.id, user.userId, force === 'true');
  }

  @Post('performance-report')
  @RequireRole('viewer')
  @ApiOperation({ summary: 'AI Skill performance-report — retrospectiva narrativa de receita/despesa por período' })
  @ApiQuery({ name: 'months', required: false, type: Number, description: 'Número de meses (default 6)' })
  runPerformanceReport(
    @CurrentTenant() t: { id: string },
    @CurrentUser() user: { userId: string },
    @Query('months') months?: string,
  ) {
    return this.insights.runPerformanceReport(t.id, user.userId, months ? +months : 6);
  }

  @Post('tracking-coverage')
  @RequireRole('manager')
  @ApiOperation({ summary: 'AI Skill analytics-tracking — cobertura real de rastreamento entre eventos de negócio e o provedor de analytics' })
  runAnalyticsTracking(
    @CurrentTenant() t: { id: string },
    @CurrentUser() user: { userId: string },
  ) {
    return this.tracking.run(t.id, user.userId);
  }
}

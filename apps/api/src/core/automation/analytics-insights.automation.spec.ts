import 'reflect-metadata';
import { AnalyticsInsightsAutomation } from './analytics-insights.automation';

function makeSkillRun(recentSuccess: unknown = null) {
  return {
    start: jest.fn(async () => 'run-1'),
    succeed: jest.fn(async () => undefined),
    fail: jest.fn(async () => undefined),
    findRecentSuccess: jest.fn(async () => recentSuccess),
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

const DASHBOARD = {
  artists: 12,
  active_contracts_count: 8,
  contracts_expiring_soon_count: 1,
  leads: 5,
  open_tickets: 2,
  campaigns: 3,
  revenue_current_month: 15000,
  expenses_current_month: 9000,
  net_result_current_month: 6000,
  pending_receivables: 2000,
  overdue_invoices_count: 1,
  pending_tasks_count: 4,
  overdue_tasks_count: 1,
  pending_external_syncs: 0,
  failed_external_syncs: 0,
};

const REVENUE_OVERVIEW = {
  months: 3,
  series: [
    { month: '2026-04-01', receitas: '10000', despesas: '6000' },
    { month: '2026-05-01', receitas: '12000', despesas: '7000' },
    { month: '2026-06-01', receitas: '15000', despesas: '9000' },
  ],
};

function makeAnalytics(dashboard: unknown = DASHBOARD, revenue: unknown = REVENUE_OVERVIEW) {
  return {
    getDashboard: jest.fn(async () => dashboard),
    getRevenueOverview: jest.fn(async () => revenue),
  };
}

const REPORTING_JSON = JSON.stringify({
  analysisSummary: 'Operação saudável, com atenção a um contrato prestes a vencer.',
  healthStatus: 'healthy',
  highlights: [{ highlight: 'Resultado líquido positivo no mês', evidence: 'netResultCurrentMonth=6000' }],
  concerns: [{ concern: 'Um contrato vencendo em breve', severity: 'low', evidence: 'contractsExpiringSoonCount=1' }],
  recommendedActions: [{ action: 'Revisar renovação do contrato', priority: 'medium' }],
});

const PERFORMANCE_JSON = JSON.stringify({
  periodSummary: 'Receita em crescimento consistente nos últimos 3 meses.',
  trend: 'growing',
  monthlyBreakdown: [{ month: 'FAKE', revenue: 999999, expenses: 0 }],
  keyObservations: [{ observation: 'Crescimento de receita mês a mês', evidence: '2026-04: 10000 -> 2026-06: 15000' }],
  recommendedActions: [{ action: 'Manter investimento em canais de aquisição', priority: 'medium' }],
});

describe('AnalyticsInsightsAutomation.runReportingAnalysis (ON_DEMAND: POST /analytics/reporting-analysis)', () => {
  it('sintetiza o dashboard real, registra skill_run e retorna o resultado', async () => {
    const skillRun = makeSkillRun();
    const ai = makeAi(REPORTING_JSON);
    const analytics = makeAnalytics();
    const handler = new AnalyticsInsightsAutomation(skillRun as never, ai as never, analytics as never);

    const result = await handler.runReportingAnalysis('t1', 'u1', false);

    expect(analytics.getDashboard).toHaveBeenCalledWith('t1');
    expect(skillRun.start).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 't1', userId: 'u1', skillName: 'reporting-analysis', entityType: null, entityId: null }),
    );

    const aiCalls = ai.complete.mock.calls as unknown as Array<[{ prompt: string }]>;
    expect(aiCalls[0][0].prompt).toContain('artists=12');
    expect(aiCalls[0][0].prompt).toContain('netResultCurrentMonth=6000');

    expect(result.fromCache).toBe(false);
    expect(result.parsed.healthStatus).toBe('healthy');
  });

  it('reaproveita análise recente (stale-refresh de 1 dia) sem nova chamada de IA', async () => {
    const cachedRun = {
      id: 'run-old',
      finished_at: new Date().toISOString(),
      output_payload: { provider: 'openai', model: 'gpt-4o-mini', generatedAt: '2026-01-01T00:00:00Z', parsed: { healthStatus: 'attention' } },
    };
    const skillRun = makeSkillRun(cachedRun);
    const ai = makeAi(REPORTING_JSON);
    const analytics = makeAnalytics();
    const handler = new AnalyticsInsightsAutomation(skillRun as never, ai as never, analytics as never);

    const result = await handler.runReportingAnalysis('t1', 'u1', false);

    expect(result.fromCache).toBe(true);
    expect(ai.complete).not.toHaveBeenCalled();
  });

  it('falha da IA registra fail e relança', async () => {
    const skillRun = makeSkillRun();
    const ai = makeFailingAi();
    const analytics = makeAnalytics();
    const handler = new AnalyticsInsightsAutomation(skillRun as never, ai as never, analytics as never);

    await expect(handler.runReportingAnalysis('t1', 'u1', false)).rejects.toThrow('Nenhum provider de AI configurado');
    expect(skillRun.fail).toHaveBeenCalledWith('run-1', 't1', 'reporting-analysis', expect.any(Error));
  });
});

describe('AnalyticsInsightsAutomation.runPerformanceReport (ON_DEMAND: POST /analytics/performance-report)', () => {
  it('ANTI-FABRICAÇÃO: monthlyBreakdown da resposta é sempre a série real, mesmo quando o provider tenta reportar outros valores', async () => {
    const skillRun = makeSkillRun();
    const ai = makeAi(PERFORMANCE_JSON);
    const analytics = makeAnalytics();
    const handler = new AnalyticsInsightsAutomation(skillRun as never, ai as never, analytics as never);

    const result = await handler.runPerformanceReport('t1', 'u1', 3);

    expect(analytics.getRevenueOverview).toHaveBeenCalledWith('t1', 3);
    expect(result.parsed.monthlyBreakdown).toEqual([
      { month: '2026-04-01', revenue: 10000, expenses: 6000, netResult: 4000 },
      { month: '2026-05-01', revenue: 12000, expenses: 7000, netResult: 5000 },
      { month: '2026-06-01', revenue: 15000, expenses: 9000, netResult: 6000 },
    ]);
    expect(result.parsed.trend).toBe('growing');
  });

  it('cada chamada gera novamente (sem cache), já que períodos diferentes produzem relatórios diferentes', async () => {
    const skillRun = makeSkillRun({
      id: 'run-old',
      finished_at: new Date().toISOString(),
      output_payload: { provider: 'openai', model: 'gpt-4o-mini', generatedAt: '2026-01-01T00:00:00Z', parsed: { trend: 'stable' } },
    });
    const ai = makeAi(PERFORMANCE_JSON);
    const analytics = makeAnalytics();
    const handler = new AnalyticsInsightsAutomation(skillRun as never, ai as never, analytics as never);

    const result = await handler.runPerformanceReport('t1', 'u1', 3);

    expect(result.fromCache).toBe(false);
    expect(ai.complete).toHaveBeenCalled();
  });

  it('falha da IA registra fail e relança', async () => {
    const skillRun = makeSkillRun();
    const ai = makeFailingAi();
    const analytics = makeAnalytics();
    const handler = new AnalyticsInsightsAutomation(skillRun as never, ai as never, analytics as never);

    await expect(handler.runPerformanceReport('t1', 'u1', 3)).rejects.toThrow('Nenhum provider de AI configurado');
    expect(skillRun.fail).toHaveBeenCalledWith('run-1', 't1', 'performance-report', expect.any(Error));
  });
});

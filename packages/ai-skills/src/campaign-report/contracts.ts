/**
 * packages/ai-skills/src/campaign-report/contracts.ts
 *
 * Contratos da skill campaign-report (version 1.0.0).
 * Retrospectiva de execução de uma campanha ao ser encerrada (concluída ou
 * cancelada) — o que foi executado internamente (tarefas, prazos, assets),
 * lições aprendidas e recomendações para próximas campanhas.
 * Fonte canônica compartilhada (web + api).
 *
 * IMPORTANTE — classificação de métricas (mandato da missão AI Skills):
 * esta skill NUNCA deve apresentar dados sintéticos como se fossem
 * resultados medidos. MUSIC OS 360 não garante uma conexão de mídia paga
 * ativa para toda campanha (a integração Google Ads é opt-in por tenant), e
 * a tabela `campaigns` não possui colunas de métricas de desempenho
 * (impressões/cliques/custo). Por isso, todo dado numérico de desempenho
 * neste contrato é EXPLICITAMENTE opcional e vem acompanhado de uma
 * classificação de origem via `MetricAvailability` — nunca inventado pelo
 * parser nem pelo prompt quando ausente.
 */

import type { SkillLanguage } from "../shared/primitives";

export type CampaignReportLanguage = SkillLanguage;

/**
 * Classificação de origem de qualquer dado quantitativo reportado:
 *   - "actual":      valor medido, vindo de uma fonte real conectada (ex.: Google Ads).
 *   - "estimated":   estimativa derivada de dados internos parciais.
 *   - "projected":   projeção qualitativa, sem base numérica direta.
 *   - "unavailable": nenhuma fonte de dado real está disponível para esta métrica.
 */
export type MetricAvailability = "actual" | "estimated" | "projected" | "unavailable";

// ─── Input ────────────────────────────────────────────────────────────────────

export interface CampaignReportExternalMetric {
  metric: string;
  value: number;
  source: string;
}

export interface CampaignReportInput {
  campaignName: string;
  campaignType: string;
  objective?: string;
  outcomeStatus: "completed" | "cancelled";
  startDate?: string;
  endDate?: string;
  relatedArtist?: string;
  tasksTotal?: number;
  tasksCompleted?: number;
  assetsUsedCount?: number;
  /** Métricas externas REAIS, apenas quando uma integração de mídia paga está conectada e retornou dados (ex.: Google Ads). NUNCA preenchido com valores inventados. */
  externalMetrics?: CampaignReportExternalMetric[];
  context?: string;
  language?: CampaignReportLanguage;
}

// ─── Blocos de saída ──────────────────────────────────────────────────────────

export interface CampaignReportMetricSummary {
  metric: string;
  availability: MetricAvailability;
  summary: string;
}

export interface CampaignReportLesson {
  lesson: string;
  category: string;
}

export interface CampaignReportRecommendation {
  recommendation: string;
  forNextCampaignType: string;
}

// ─── Output ───────────────────────────────────────────────────────────────────

export interface CampaignReportOutput {
  executionSummary: string;
  /** true somente quando externalMetrics não estava vazio no input. */
  hasMeasuredPerformanceData: boolean;
  metricSummaries: CampaignReportMetricSummary[];
  lessonsLearned: CampaignReportLesson[];
  recommendations: CampaignReportRecommendation[];
}

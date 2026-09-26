/**
 * packages/ai-skills/src/campaign-report/contracts.ts
 *
 * Contracts of the campaign-report skill (version 1.0.0).
 * Execution retrospective of a campaign when it closes (completed or
 * cancelled) — what was executed internally (tasks, deadlines, assets), lessons
 * learned and recommendations for the next campaigns.
 * Shared canonical source (web + api).
 *
 * IMPORTANT — metric classification (AI Skills mission mandate): this skill
 * must NEVER present synthetic data as measured results. MUSIC OS 360 does not
 * guarantee an active paid media connection for every campaign (the Google Ads
 * integration is opt-in per tenant), and the `campaigns` table has no
 * performance metric columns (impressions/clicks/cost). So every numeric
 * performance datum in this contract is EXPLICITLY optional and comes with an
 * origin classification via `MetricAvailability` — never invented by the
 * parser or the prompt when absent.
 */

import type { SkillLanguage } from "../shared/primitives";

export type CampaignReportLanguage = SkillLanguage;

/**
 * Origin classification of any reported quantitative datum:
 *   - "actual":      measured value from a real connected source (e.g. Google Ads).
 *   - "estimated":   estimate derived from partial internal data.
 *   - "projected":   qualitative projection without a direct numeric basis.
 *   - "unavailable": no real data source is available for this metric.
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
  /** REAL external metrics, only when a paid media integration is connected and returned data (e.g. Google Ads). NEVER filled with invented values. */
  externalMetrics?: CampaignReportExternalMetric[];
  context?: string;
  language?: CampaignReportLanguage;
}

// ─── Output blocks ────────────────────────────────────────────────────────────

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
  /** true only when externalMetrics was not empty in the input. */
  hasMeasuredPerformanceData: boolean;
  metricSummaries: CampaignReportMetricSummary[];
  lessonsLearned: CampaignReportLesson[];
  recommendations: CampaignReportRecommendation[];
}

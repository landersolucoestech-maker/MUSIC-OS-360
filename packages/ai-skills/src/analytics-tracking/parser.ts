/**
 * packages/ai-skills/src/analytics-tracking/parser.ts
 *
 * Converts the provider's raw response into a structured
 * AnalyticsTrackingOutput.
 *
 * ANTI-FABRICATION: coveragePercentage is ALWAYS derived from the real
 * input.coverage (never from the model's JSON) — the model is not allowed to
 * report a coverage different from the real one.
 */

import type {
  AnalyticsTrackingInput,
  AnalyticsTrackingOutput,
  AnalyticsTrackingGap,
  AnalyticsTrackingRecommendation,
} from "./contracts";
import type { SkillSeverity } from "../shared/primitives";

const SEVERITIES: SkillSeverity[] = ["low", "medium", "high", "critical"];

const HEURISTIC_NOTE = "Auditoria heurística local: a análise detalhada do modelo não foi executada.";

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

function asSeverity(value: unknown): SkillSeverity {
  const v = asString(value).toLowerCase();
  return (SEVERITIES as string[]).includes(v) ? (v as SkillSeverity) : "medium";
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is Record<string, unknown> => typeof v === "object" && v !== null);
}

function mapGaps(value: unknown): AnalyticsTrackingGap[] {
  return asRecordArray(value)
    .map((v) => ({ gap: asString(v.gap), severity: asSeverity(v.severity) }))
    .filter((v) => v.gap.length > 0);
}

function mapRecommendations(value: unknown): AnalyticsTrackingRecommendation[] {
  return asRecordArray(value)
    .map((v) => ({
      recommendation: asString(v.recommendation),
      businessEvent: typeof v.businessEvent === "string" && v.businessEvent.trim() ? v.businessEvent.trim() : null,
    }))
    .filter((v) => v.recommendation.length > 0);
}

function computeCoveragePercentage(input: AnalyticsTrackingInput): number {
  if (input.coverage.length === 0) return 0;
  const tracked = input.coverage.filter((c) => c.hasProviderTracking).length;
  return Math.round((tracked / input.coverage.length) * 10000) / 100;
}

function buildFallback(input: AnalyticsTrackingInput): AnalyticsTrackingOutput {
  const percentage = computeCoveragePercentage(input);
  const gaps: AnalyticsTrackingGap[] = [];
  if (input.providerState === "configuration_required") {
    gaps.push({ gap: `Provedor ${input.providerName} não está configurado`, severity: "critical" });
  }
  return {
    coverageSummary: `${HEURISTIC_NOTE} ${percentage}% de cobertura de rastreamento (${input.providerName}).`,
    coveragePercentage: percentage,
    gaps,
    recommendations: [],
  };
}

function extractJson(raw: string): Record<string, unknown> | null {
  if (!raw) return null;
  const fenced = raw.match(/```(?:json)?([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : raw;
  const direct = tryParse(candidate);
  if (direct) return direct;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    return tryParse(candidate.slice(start, end + 1));
  }
  return null;
}

function tryParse(text: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(text.trim());
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // ignore — the response was not valid JSON
  }
  return null;
}

export function parseAnalyticsTrackingResponse(
  raw: string,
  input: AnalyticsTrackingInput,
): AnalyticsTrackingOutput {
  const json = extractJson(raw);
  const fallback = buildFallback(input);

  if (!json) return fallback;

  return {
    coverageSummary: asString(json.coverageSummary) || fallback.coverageSummary,
    // ENFORCEMENT: always derived from the real input, never from the model.
    coveragePercentage: fallback.coveragePercentage,
    gaps: mapGaps(json.gaps).length > 0 ? mapGaps(json.gaps) : fallback.gaps,
    recommendations: mapRecommendations(json.recommendations),
  };
}

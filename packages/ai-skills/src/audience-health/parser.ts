/**
 * packages/ai-skills/src/audience-health/parser.ts
 *
 * Converts the provider's raw response into a structured AudienceHealthOutput.
 * General strategy (same as the package's other skills): extracts JSON
 * (with/without markdown fences), coerces each field, and falls back to a safe
 * heuristic output when malformed. NEVER throws.
 */

import type {
  AudienceHealthInput,
  AudienceHealthOutput,
  AudienceHealthStatus,
  AudienceHealthStrength,
  AudienceHealthConcern,
  AudienceHealthAction,
} from "./contracts";
import type { SkillSeverity, SkillPriority } from "../shared/primitives";

const STATUSES: AudienceHealthStatus[] = ["healthy", "attention", "critical", "insufficient_data"];
const SEVERITIES: SkillSeverity[] = ["low", "medium", "high", "critical"];
const PRIORITIES: SkillPriority[] = ["low", "medium", "high", "critical"];

const HEURISTIC_NOTE = "Síntese heurística local: a análise detalhada do modelo não foi executada.";

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => (typeof v === "string" ? v.trim() : "")).filter((v) => v.length > 0);
}

function asHealthStatus(value: unknown): AudienceHealthStatus {
  const v = asString(value).toLowerCase();
  return (STATUSES as string[]).includes(v) ? (v as AudienceHealthStatus) : "insufficient_data";
}

function asSeverity(value: unknown): SkillSeverity {
  const v = asString(value).toLowerCase();
  return (SEVERITIES as string[]).includes(v) ? (v as SkillSeverity) : "medium";
}

function asPriority(value: unknown): SkillPriority {
  const v = asString(value).toLowerCase();
  return (PRIORITIES as string[]).includes(v) ? (v as SkillPriority) : "medium";
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is Record<string, unknown> => typeof v === "object" && v !== null);
}

function mapStrengths(value: unknown): AudienceHealthStrength[] {
  return asRecordArray(value)
    .map((v) => ({ strength: asString(v.strength), evidence: asString(v.evidence) }))
    .filter((v) => v.strength.length > 0);
}

function mapConcerns(value: unknown): AudienceHealthConcern[] {
  return asRecordArray(value)
    .map((v) => ({ concern: asString(v.concern), severity: asSeverity(v.severity), evidence: asString(v.evidence) }))
    .filter((v) => v.concern.length > 0);
}

function mapActions(value: unknown): AudienceHealthAction[] {
  return asRecordArray(value)
    .map((v) => ({ action: asString(v.action), priority: asPriority(v.priority) }))
    .filter((v) => v.action.length > 0);
}

function buildFallback(input: AudienceHealthInput): AudienceHealthOutput {
  const gaps: string[] = [];
  if (input.careerStageStatus !== "OK") gaps.push("Career Stage: dados insuficientes.");
  if (input.marketBenchmarkReadStatus !== "READY" && input.marketBenchmarkReadStatus !== "STALE") {
    gaps.push(`Market Benchmark indisponível (${input.marketBenchmarkReadStatus}).`);
  }
  return {
    healthSummary: `${HEURISTIC_NOTE} Artista "${input.artistName}".`,
    healthStatus: gaps.length > 0 ? "insufficient_data" : "attention",
    strengths: [],
    concerns: [],
    recommendedActions: [],
    dataGaps: gaps,
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

export function parseAudienceHealthResponse(
  raw: string,
  input: AudienceHealthInput,
): AudienceHealthOutput {
  const json = extractJson(raw);
  const fallback = buildFallback(input);

  if (!json) return fallback;

  return {
    healthSummary: asString(json.healthSummary) || fallback.healthSummary,
    healthStatus: asHealthStatus(json.healthStatus),
    strengths: mapStrengths(json.strengths),
    concerns: mapConcerns(json.concerns),
    recommendedActions: mapActions(json.recommendedActions),
    dataGaps: asStringArray(json.dataGaps).length > 0 ? asStringArray(json.dataGaps) : fallback.dataGaps,
  };
}

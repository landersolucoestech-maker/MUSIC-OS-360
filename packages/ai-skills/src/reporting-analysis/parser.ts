/**
 * packages/ai-skills/src/reporting-analysis/parser.ts
 *
 * Converte a resposta crua do provider em ReportingAnalysisOutput
 * estruturado. Estratégia geral (igual às demais skills do pacote): extrai
 * JSON (com/sem cercas markdown), coage cada campo, cai para fallback
 * heurístico seguro quando malformado. NUNCA lança.
 */

import type {
  ReportingAnalysisInput,
  ReportingAnalysisOutput,
  ReportingAnalysisHealthStatus,
  ReportingAnalysisHighlight,
  ReportingAnalysisConcern,
  ReportingAnalysisAction,
} from "./contracts";
import type { SkillSeverity, SkillPriority } from "../shared/primitives";

const HEALTH_STATUSES: ReportingAnalysisHealthStatus[] = ["healthy", "attention", "critical"];
const SEVERITIES: SkillSeverity[] = ["low", "medium", "high", "critical"];
const PRIORITIES: SkillPriority[] = ["low", "medium", "high", "critical"];

const HEURISTIC_NOTE = "Análise heurística local: a síntese detalhada do modelo não foi executada.";

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

function asHealthStatus(value: unknown): ReportingAnalysisHealthStatus {
  const v = asString(value).toLowerCase();
  return (HEALTH_STATUSES as string[]).includes(v) ? (v as ReportingAnalysisHealthStatus) : "attention";
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

function mapHighlights(value: unknown): ReportingAnalysisHighlight[] {
  return asRecordArray(value)
    .map((v) => ({ highlight: asString(v.highlight), evidence: asString(v.evidence) }))
    .filter((v) => v.highlight.length > 0);
}

function mapConcerns(value: unknown): ReportingAnalysisConcern[] {
  return asRecordArray(value)
    .map((v) => ({ concern: asString(v.concern), severity: asSeverity(v.severity), evidence: asString(v.evidence) }))
    .filter((v) => v.concern.length > 0);
}

function mapActions(value: unknown): ReportingAnalysisAction[] {
  return asRecordArray(value)
    .map((v) => ({ action: asString(v.action), priority: asPriority(v.priority) }))
    .filter((v) => v.action.length > 0);
}

function buildFallback(input: ReportingAnalysisInput): ReportingAnalysisOutput {
  const concerns: ReportingAnalysisConcern[] = [];
  if (input.netResultCurrentMonth < 0) {
    concerns.push({ concern: "Resultado líquido do mês é negativo.", severity: "high", evidence: `netResultCurrentMonth=${input.netResultCurrentMonth}` });
  }
  return {
    analysisSummary: `${HEURISTIC_NOTE} ${input.artists} artistas, ${input.campaigns} campanhas.`,
    healthStatus: concerns.length > 0 ? "attention" : "healthy",
    highlights: [],
    concerns,
    recommendedActions: [],
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
    // ignora — resposta não era JSON válido
  }
  return null;
}

export function parseReportingAnalysisResponse(
  raw: string,
  input: ReportingAnalysisInput,
): ReportingAnalysisOutput {
  const json = extractJson(raw);
  const fallback = buildFallback(input);

  if (!json) return fallback;

  return {
    analysisSummary: asString(json.analysisSummary) || fallback.analysisSummary,
    healthStatus: asHealthStatus(json.healthStatus),
    highlights: mapHighlights(json.highlights),
    concerns: mapConcerns(json.concerns).length > 0 ? mapConcerns(json.concerns) : fallback.concerns,
    recommendedActions: mapActions(json.recommendedActions),
  };
}

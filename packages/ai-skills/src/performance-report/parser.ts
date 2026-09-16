/**
 * packages/ai-skills/src/performance-report/parser.ts
 *
 * Converte a resposta crua do provider em PerformanceReportOutput
 * estruturado.
 *
 * ANTI-FABRICAÇÃO (crítico, igual ao princípio de campaign-report): o
 * runner de automação NÃO chama validateOutput — apenas validateInput. Por
 * isso, `monthlyBreakdown` é SEMPRE reconstruído aqui diretamente a partir
 * de `input.series` (dado real), IGNORANDO completamente o que o modelo
 * tenha devolvido nesse campo — o modelo nunca reproduz números
 * financeiros, apenas narrativa/classificação.
 *
 * Estratégia geral (igual às demais skills do pacote): extrai JSON
 * (com/sem cercas markdown), coage cada campo, cai para fallback heurístico
 * seguro quando malformado. NUNCA lança.
 */

import type {
  PerformanceReportInput,
  PerformanceReportOutput,
  PerformanceReportTrend,
  PerformanceReportMonthlyBreakdown,
  PerformanceReportObservation,
  PerformanceReportAction,
} from "./contracts";
import type { SkillPriority } from "../shared/primitives";

const TRENDS: PerformanceReportTrend[] = ["growing", "declining", "stable", "volatile"];
const PRIORITIES: SkillPriority[] = ["low", "medium", "high", "critical"];

const HEURISTIC_NOTE = "Retrospectiva heurística local: a análise detalhada do modelo não foi executada.";

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

function asTrend(value: unknown): PerformanceReportTrend {
  const v = asString(value).toLowerCase();
  return (TRENDS as string[]).includes(v) ? (v as PerformanceReportTrend) : "stable";
}

function asPriority(value: unknown): SkillPriority {
  const v = asString(value).toLowerCase();
  return (PRIORITIES as string[]).includes(v) ? (v as SkillPriority) : "medium";
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is Record<string, unknown> => typeof v === "object" && v !== null);
}

function mapObservations(value: unknown): PerformanceReportObservation[] {
  return asRecordArray(value)
    .map((v) => ({ observation: asString(v.observation), evidence: asString(v.evidence) }))
    .filter((v) => v.observation.length > 0);
}

function mapActions(value: unknown): PerformanceReportAction[] {
  return asRecordArray(value)
    .map((v) => ({ action: asString(v.action), priority: asPriority(v.priority) }))
    .filter((v) => v.action.length > 0);
}

/** Sempre derivado do input real — nunca do JSON do modelo. */
function buildMonthlyBreakdown(input: PerformanceReportInput): PerformanceReportMonthlyBreakdown[] {
  return input.series.map((p) => ({
    month: p.month,
    revenue: p.revenue,
    expenses: p.expenses,
    netResult: p.revenue - p.expenses,
  }));
}

function computeHeuristicTrend(input: PerformanceReportInput): PerformanceReportTrend {
  if (input.series.length < 2) return "stable";
  const first = input.series[0].revenue - input.series[0].expenses;
  const last = input.series[input.series.length - 1].revenue - input.series[input.series.length - 1].expenses;
  if (last > first * 1.1) return "growing";
  if (last < first * 0.9) return "declining";
  return "stable";
}

function buildFallback(input: PerformanceReportInput): PerformanceReportOutput {
  return {
    periodSummary: `${HEURISTIC_NOTE} ${input.months} meses analisados.`,
    trend: computeHeuristicTrend(input),
    monthlyBreakdown: buildMonthlyBreakdown(input),
    keyObservations: [],
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

export function parsePerformanceReportResponse(
  raw: string,
  input: PerformanceReportInput,
): PerformanceReportOutput {
  const json = extractJson(raw);
  const fallback = buildFallback(input);

  if (!json) return fallback;

  return {
    periodSummary: asString(json.periodSummary) || fallback.periodSummary,
    trend: asTrend(json.trend),
    // ENFORCEMENT: sempre reconstruído do input real, nunca do modelo.
    monthlyBreakdown: buildMonthlyBreakdown(input),
    keyObservations: mapObservations(json.keyObservations),
    recommendedActions: mapActions(json.recommendedActions),
  };
}

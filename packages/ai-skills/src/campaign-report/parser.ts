/**
 * packages/ai-skills/src/campaign-report/parser.ts
 *
 * Converte a resposta crua do provider em CampaignReportOutput estruturado.
 *
 * ENFORCEMENT ANTI-FABRICAÇÃO (crítico): o runner de automação
 * (native-skill-automation.runner.ts) NÃO chama validateCampaignReportOutput
 * — apenas validateInput. Por isso, esta é a ÚLTIMA linha de defesa contra o
 * modelo "inventar" que mediu desempenho: independentemente do que o JSON
 * bruto do provider disser, se `input.externalMetrics` estiver vazio/ausente,
 * este parser FORÇA hasMeasuredPerformanceData=false e rebaixa qualquer
 * metricSummaries.availability="actual" para "unavailable", descartando
 * qualquer valor numérico que o modelo tenha tentado incluir.
 *
 * Estratégia geral (igual às demais skills do pacote): extrai JSON
 * (com/sem cercas markdown), coage cada campo, cai para fallback heurístico
 * seguro quando malformado. NUNCA lança.
 */

import type {
  CampaignReportInput,
  CampaignReportOutput,
  CampaignReportMetricSummary,
  CampaignReportLesson,
  CampaignReportRecommendation,
  MetricAvailability,
} from "./contracts";

const AVAILABILITIES: MetricAvailability[] = ["actual", "estimated", "projected", "unavailable"];

const HEURISTIC_NOTE = "Retrospectiva heurística local: a análise detalhada do modelo não foi executada.";

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

function asAvailability(value: unknown): MetricAvailability {
  const v = asString(value).toLowerCase();
  return (AVAILABILITIES as string[]).includes(v) ? (v as MetricAvailability) : "unavailable";
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is Record<string, unknown> => typeof v === "object" && v !== null);
}

function mapMetricSummaries(value: unknown): CampaignReportMetricSummary[] {
  return asRecordArray(value).map((m) => ({
    metric: asString(m.metric),
    availability: asAvailability(m.availability),
    summary: asString(m.summary),
  })).filter((m) => m.metric.length > 0);
}

function mapLessons(value: unknown): CampaignReportLesson[] {
  return asRecordArray(value).map((l) => ({
    lesson: asString(l.lesson),
    category: asString(l.category, "geral"),
  })).filter((l) => l.lesson.length > 0);
}

function mapRecommendations(value: unknown): CampaignReportRecommendation[] {
  return asRecordArray(value).map((r) => ({
    recommendation: asString(r.recommendation),
    forNextCampaignType: asString(r.forNextCampaignType, "geral"),
  })).filter((r) => r.recommendation.length > 0);
}

/** Rebaixa qualquer availability="actual" para "unavailable" e descarta o resumo numérico quando não há métricas reais no input. */
function enforceNoFabricatedMetrics(
  summaries: CampaignReportMetricSummary[],
  hadRealMetrics: boolean,
): CampaignReportMetricSummary[] {
  if (hadRealMetrics) return summaries;
  return summaries.map((m) =>
    m.availability === "actual"
      ? { ...m, availability: "unavailable" as MetricAvailability, summary: "Sem fonte de dado real conectada para esta métrica." }
      : m,
  );
}

function buildFallback(input: CampaignReportInput): CampaignReportOutput {
  const hadRealMetrics = Array.isArray(input.externalMetrics) && input.externalMetrics.length > 0;
  return {
    executionSummary: `${HEURISTIC_NOTE} Campanha "${input.campaignName}" encerrada como ${input.outcomeStatus === "completed" ? "concluída" : "cancelada"}.`,
    hasMeasuredPerformanceData: hadRealMetrics,
    metricSummaries: hadRealMetrics
      ? input.externalMetrics!.map((m) => ({
          metric: m.metric,
          availability: "actual" as MetricAvailability,
          summary: `Valor real reportado por ${m.source}: ${m.value}.`,
        }))
      : [{ metric: "desempenho", availability: "unavailable" as MetricAvailability, summary: "Nenhuma integração de mídia paga conectada retornou dados para esta campanha." }],
    lessonsLearned: [],
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
    // ignora — resposta não era JSON válido
  }
  return null;
}

export function parseCampaignReportResponse(
  raw: string,
  input: CampaignReportInput,
): CampaignReportOutput {
  const hadRealMetrics = Array.isArray(input.externalMetrics) && input.externalMetrics.length > 0;
  const json = extractJson(raw);
  const fallback = buildFallback(input);

  if (!json) return fallback;

  const metricSummaries = enforceNoFabricatedMetrics(mapMetricSummaries(json.metricSummaries), hadRealMetrics);

  return {
    executionSummary: asString(json.executionSummary) || fallback.executionSummary,
    // ENFORCEMENT: nunca true sem métricas reais no input, independentemente do que o modelo disse.
    hasMeasuredPerformanceData: hadRealMetrics && asBoolean(json.hasMeasuredPerformanceData),
    metricSummaries: metricSummaries.length > 0 ? metricSummaries : fallback.metricSummaries,
    lessonsLearned: mapLessons(json.lessonsLearned),
    recommendations: mapRecommendations(json.recommendations),
  };
}

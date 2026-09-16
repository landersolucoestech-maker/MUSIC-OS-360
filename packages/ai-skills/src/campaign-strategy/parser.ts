/**
 * packages/ai-skills/src/campaign-strategy/parser.ts
 *
 * Converte a resposta crua do provider em CampaignStrategyOutput estruturado.
 * Mesma estratégia das demais skills do pacote: extrai JSON (com/sem cercas
 * markdown), coage cada campo, e cai para um fallback heurístico seguro
 * quando a resposta é malformada. NUNCA lança.
 */

import type {
  CampaignStrategyInput,
  CampaignStrategyOutput,
  CampaignKeyMessage,
  CampaignMetricToWatch,
  CampaignAdjustmentTrigger,
} from "./contracts";
import type { SkillSeverity } from "../shared/primitives";

const SEVERITIES: SkillSeverity[] = ["low", "medium", "high", "critical"];

const HEURISTIC_NOTE = "Direção heurística local: a estratégia detalhada do modelo não foi executada. Revise antes de comunicar externamente.";

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

function mapKeyMessages(value: unknown): CampaignKeyMessage[] {
  return asRecordArray(value).map((m) => ({
    message: asString(m.message),
    audience: asString(m.audience, "geral"),
  })).filter((m) => m.message.length > 0);
}

function mapMetrics(value: unknown): CampaignMetricToWatch[] {
  return asRecordArray(value).map((m) => ({
    metric: asString(m.metric),
    why: asString(m.why),
  })).filter((m) => m.metric.length > 0);
}

function mapTriggers(value: unknown): CampaignAdjustmentTrigger[] {
  return asRecordArray(value).map((t) => ({
    signal: asString(t.signal),
    severity: asSeverity(t.severity),
    response: asString(t.response),
  })).filter((t) => t.signal.length > 0);
}

function buildFallback(input: CampaignStrategyInput): CampaignStrategyOutput {
  return {
    strategicDirection: `${HEURISTIC_NOTE} Campanha "${input.campaignName}" (${input.campaignType}).`,
    targetAudience: input.objective ? `Público alinhado ao objetivo: ${input.objective}.` : "Não determinado — dados insuficientes.",
    competitivePositioning: "Não determinado — planejamento heurístico local.",
    keyMessages: [],
    metricsToWatch: [],
    adjustmentTriggers: [],
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

export function parseCampaignStrategyResponse(
  raw: string,
  input: CampaignStrategyInput,
): CampaignStrategyOutput {
  const json = extractJson(raw);
  const fallback = buildFallback(input);

  if (!json) return fallback;

  return {
    strategicDirection: asString(json.strategicDirection) || fallback.strategicDirection,
    targetAudience: asString(json.targetAudience) || fallback.targetAudience,
    competitivePositioning: asString(json.competitivePositioning) || fallback.competitivePositioning,
    keyMessages: mapKeyMessages(json.keyMessages),
    metricsToWatch: mapMetrics(json.metricsToWatch),
    adjustmentTriggers: mapTriggers(json.adjustmentTriggers),
  };
}

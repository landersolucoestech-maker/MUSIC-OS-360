/**
 * packages/ai-skills/src/paid-ads/parser.ts
 *
 * Converte a resposta crua do provider em PaidAdsOutput estruturado.
 * Estratégia (igual a campaign-plan/parser.ts): extrai JSON, coage campos,
 * RENORMALIZA platformSplit para somar exatamente 100 quando o modelo
 * divergir, cai para fallback heurístico seguro quando malformado. NUNCA
 * lança.
 */

import type {
  PaidAdsInput,
  PaidAdsOutput,
  PaidAdsPlatformSplit,
  PaidAdsPlacementRecommendation,
  PaidAdsRisk,
} from "./contracts";
import type { SkillSeverity } from "../shared/primitives";

const SEVERITIES: SkillSeverity[] = ["low", "medium", "high", "critical"];

const HEURISTIC_NOTE = "Estratégia heurística local: a análise detalhada do modelo não foi executada. Revise antes de operacionalizar.";

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value.replace(/%/g, "").replace(",", "."));
    if (Number.isFinite(n)) return n;
  }
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

function mapPlatformSplit(value: unknown, knownPlatforms: string[]): PaidAdsPlatformSplit[] {
  const raw = asRecordArray(value)
    .map((v) => ({
      platform: asString(v.platform),
      percentageShare: Math.max(0, asNumber(v.percentageShare)),
      rationale: asString(v.rationale),
    }))
    .filter((v) => v.platform.length > 0);

  if (raw.length === 0) {
    // Fallback: distribui igualmente entre as plataformas conhecidas do input.
    if (knownPlatforms.length === 0) return [];
    const equalShare = Math.round((100 / knownPlatforms.length) * 100) / 100;
    return knownPlatforms.map((platform) => ({ platform, percentageShare: equalShare, rationale: "" }));
  }

  const sum = raw.reduce((acc, p) => acc + p.percentageShare, 0);
  if (sum <= 0) {
    const equalShare = Math.round((100 / raw.length) * 100) / 100;
    return raw.map((p) => ({ ...p, percentageShare: equalShare }));
  }
  if (Math.round(sum) !== 100) {
    return raw.map((p) => ({ ...p, percentageShare: Math.round((p.percentageShare / sum) * 10000) / 100 }));
  }
  return raw;
}

function mapPlacements(value: unknown): PaidAdsPlacementRecommendation[] {
  return asRecordArray(value)
    .map((v) => ({ platform: asString(v.platform), placement: asString(v.placement), rationale: asString(v.rationale) }))
    .filter((v) => v.platform.length > 0 && v.placement.length > 0);
}

function mapRisks(value: unknown): PaidAdsRisk[] {
  return asRecordArray(value)
    .map((v) => ({ risk: asString(v.risk), severity: asSeverity(v.severity) }))
    .filter((v) => v.risk.length > 0);
}

function buildFallback(input: PaidAdsInput): PaidAdsOutput {
  const knownPlatforms = input.platforms.map((p) => p.platform);
  const equalShare = knownPlatforms.length > 0 ? Math.round((100 / knownPlatforms.length) * 100) / 100 : 0;
  return {
    strategySummary: `${HEURISTIC_NOTE} Campanha "${input.campaignName}".`,
    platformSplit: knownPlatforms.map((platform) => ({ platform, percentageShare: equalShare, rationale: "Distribuição igualitária heurística." })),
    placementRecommendations: [],
    budgetNotes: input.totalBudget === undefined && input.dailyBudget === undefined
      ? "Orçamento não informado — estratégia heurística não pôde sugerir alocação com base em valores reais."
      : "Estratégia heurística local — revisar alocação manualmente.",
    risks: [],
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

export function parsePaidAdsResponse(
  raw: string,
  input: PaidAdsInput,
): PaidAdsOutput {
  const json = extractJson(raw);
  const fallback = buildFallback(input);
  const knownPlatforms = input.platforms.map((p) => p.platform);

  if (!json) return fallback;

  return {
    strategySummary: asString(json.strategySummary) || fallback.strategySummary,
    platformSplit: mapPlatformSplit(json.platformSplit, knownPlatforms),
    placementRecommendations: mapPlacements(json.placementRecommendations),
    budgetNotes: asString(json.budgetNotes) || fallback.budgetNotes,
    risks: mapRisks(json.risks),
  };
}

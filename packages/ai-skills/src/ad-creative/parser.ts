/**
 * packages/ai-skills/src/ad-creative/parser.ts
 *
 * Converte a resposta crua do provider em AdCreativeOutput estruturado.
 * Estratégia geral (igual às demais skills do pacote): extrai JSON
 * (com/sem cercas markdown), coage cada campo, cai para fallback heurístico
 * seguro quando malformado. NUNCA lança.
 */

import type {
  AdCreativeInput,
  AdCreativeOutput,
  AdCreativeVariant,
  AdCreativeRisk,
} from "./contracts";
import type { SkillSeverity } from "../shared/primitives";

const SEVERITIES: SkillSeverity[] = ["low", "medium", "high", "critical"];

const HEURISTIC_NOTE = "Sugestão heurística local: a geração detalhada do modelo não foi executada. Revise antes de usar.";

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

function mapVariants(value: unknown): AdCreativeVariant[] {
  return asRecordArray(value)
    .map((v) => ({
      headline: asString(v.headline),
      primaryCopy: asString(v.primaryCopy),
      description: asString(v.description),
      cta: asString(v.cta),
      tone: asString(v.tone, "neutro"),
    }))
    .filter((v) => v.headline.length > 0 && v.primaryCopy.length > 0);
}

function mapRisks(value: unknown): AdCreativeRisk[] {
  return asRecordArray(value)
    .map((v) => ({ risk: asString(v.risk), severity: asSeverity(v.severity) }))
    .filter((v) => v.risk.length > 0);
}

function buildFallback(input: AdCreativeInput): AdCreativeOutput {
  return {
    creativeSummary: `${HEURISTIC_NOTE} Campanha "${input.campaignName}".`,
    variants: [
      {
        headline: input.promotedEntityName,
        primaryCopy: `Confira ${input.promotedEntityName}.`,
        description: "",
        cta: "Saiba mais",
        tone: "direto",
      },
    ],
    platformNotes: `Revisar limites de formato de ${input.platform} / ${input.placement} manualmente.`,
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

export function parseAdCreativeResponse(
  raw: string,
  input: AdCreativeInput,
): AdCreativeOutput {
  const json = extractJson(raw);
  const fallback = buildFallback(input);

  if (!json) return fallback;

  const variants = mapVariants(json.variants);

  return {
    creativeSummary: asString(json.creativeSummary) || fallback.creativeSummary,
    variants: variants.length > 0 ? variants : fallback.variants,
    platformNotes: asString(json.platformNotes) || fallback.platformNotes,
    risks: mapRisks(json.risks),
  };
}

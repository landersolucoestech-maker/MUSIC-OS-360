/**
 * packages/ai-skills/src/ad-creative/parser.ts
 *
 * Converts the provider's raw response into a structured AdCreativeOutput.
 * General strategy (same as the package's other skills): extracts JSON
 * (with/without markdown fences), coerces each field, and falls back to a safe
 * heuristic output when malformed. NEVER throws.
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
    // ignore — the response was not valid JSON
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

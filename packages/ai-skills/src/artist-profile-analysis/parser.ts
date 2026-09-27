/**
 * packages/ai-skills/src/artist-profile-analysis/parser.ts
 *
 * Converts the provider's raw response into a structured ArtistProfileAnalysisOutput.
 * Strategy:
 *  1. try to extract and parse JSON from the response (with/without markdown fences, with surrounding text);
 *  2. coerce each field to the expected shape, dropping invalid values;
 *  3. if nothing is usable, return a safe structured fallback built from
 *     artistName/genre/audience/strengths/weaknesses (flagged in the text as a
 *     local heuristic analysis).
 * NEVER throws — any malformed response yields a valid output.
 */

import type {
  ArtistProfileAnalysisInput,
  ArtistProfileAnalysisOutput,
  ArtistStrength,
  ArtistWeakness,
  ArtistOpportunity,
  ArtistRisk,
  ArtistRecommendedAction,
  ArtistPlatformRecommendation,
} from "./contracts";
import type { SkillSeverity, SkillPriority } from "../shared/primitives";

const SEVERITIES: SkillSeverity[] = ["low", "medium", "high", "critical"];
const PRIORITIES: SkillPriority[] = ["low", "medium", "high", "critical"];

const HEURISTIC_NOTE = "Análise heurística local: o diagnóstico detalhado do modelo não foi executado. Revise antes de tomar decisões estratégicas.";

// ─── Coercion helpers ─────────────────────────────────────────────────────────

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
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

// ─── Block mappers ────────────────────────────────────────────────────────────

function mapStrengths(value: unknown): ArtistStrength[] {
  return asRecordArray(value).map((s) => ({
    point:  asString(s.point),
    impact: asString(s.impact),
  }));
}

function mapWeaknesses(value: unknown): ArtistWeakness[] {
  return asRecordArray(value).map((w) => ({
    point:          asString(w.point),
    risk:           asString(w.risk),
    recommendation: asString(w.recommendation),
  }));
}

function mapOpportunities(value: unknown): ArtistOpportunity[] {
  return asRecordArray(value).map((o) => ({
    opportunity: asString(o.opportunity),
    priority:    asPriority(o.priority),
    rationale:   asString(o.rationale),
  }));
}

function mapRisks(value: unknown): ArtistRisk[] {
  return asRecordArray(value).map((r) => ({
    risk:       asString(r.risk),
    severity:   asSeverity(r.severity),
    mitigation: asString(r.mitigation),
  }));
}

function mapRecommendedActions(value: unknown): ArtistRecommendedAction[] {
  return asRecordArray(value).map((a) => ({
    action:   asString(a.action),
    area:     asString(a.area),
    priority: asPriority(a.priority),
  }));
}

function mapPlatformRecommendations(value: unknown): ArtistPlatformRecommendation[] {
  return asRecordArray(value).map((p) => ({
    platform:       asString(p.platform),
    recommendation: asString(p.recommendation),
    priority:       asPriority(p.priority),
  }));
}

// ─── Safe structured fallback ─────────────────────────────────────────────────

function buildFallback(input: ArtistProfileAnalysisInput): ArtistProfileAnalysisOutput {
  const genrePart = input.genre ? ` no gênero ${input.genre}` : "";
  const audiencePart = input.audience ? ` Público atual: ${input.audience}.` : "";

  return {
    positioning:
      `Posicionamento de ${input.artistName}${genrePart}. ${HEURISTIC_NOTE}`,
    audienceAnalysis:
      `${audiencePart ? audiencePart.trim() : "Dados de público não informados."} ${HEURISTIC_NOTE}`.trim(),
    strengths: (input.strengths ?? []).map((point) => ({
      point,
      impact: "Impacto positivo a confirmar com análise detalhada.",
    })),
    weaknesses: (input.weaknesses ?? []).map((point) => ({
      point,
      risk: "Risco a avaliar.",
      recommendation: "Definir plano de melhoria.",
    })),
    opportunities: [],
    risks: [],
    brandNarrative:
      `Narrativa de marca base para ${input.artistName}${genrePart}. ${HEURISTIC_NOTE}`,
    recommendedActions: [
      { action: "Revisar posicionamento e narrativa com a direção artística.", area: "Estratégia", priority: "high" },
    ],
    platformRecommendations: (input.platforms ?? []).map((p) => ({
      platform: p.platform,
      recommendation: `Avaliar presença e cadência no canal ${p.platform}. ${HEURISTIC_NOTE}`,
      priority: "medium" as SkillPriority,
    })),
  };
}

// ─── JSON extraction from the response ────────────────────────────────────────

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

// ─── Parser principal ─────────────────────────────────────────────────────────

export function parseArtistProfileAnalysisResponse(
  raw: string,
  input: ArtistProfileAnalysisInput,
): ArtistProfileAnalysisOutput {
  const json = extractJson(raw);

  const fallback = buildFallback(input);

  if (!json) {
    return fallback;
  }

  return {
    positioning:             asString(json.positioning) || fallback.positioning,
    audienceAnalysis:        asString(json.audienceAnalysis) || fallback.audienceAnalysis,
    strengths:               json.strengths !== undefined ? mapStrengths(json.strengths) : fallback.strengths,
    weaknesses:              json.weaknesses !== undefined ? mapWeaknesses(json.weaknesses) : fallback.weaknesses,
    opportunities:           mapOpportunities(json.opportunities),
    risks:                   mapRisks(json.risks),
    brandNarrative:          asString(json.brandNarrative) || fallback.brandNarrative,
    recommendedActions:      mapRecommendedActions(json.recommendedActions),
    platformRecommendations: json.platformRecommendations !== undefined
      ? mapPlatformRecommendations(json.platformRecommendations)
      : fallback.platformRecommendations,
  };
}

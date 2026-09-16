/**
 * packages/ai-skills/src/launch-strategy/parser.ts
 *
 * Converte a resposta crua do provider em LaunchStrategyOutput estruturado.
 * Estratégia geral (igual às demais skills do pacote): extrai JSON
 * (com/sem cercas markdown), coage cada campo, cai para fallback heurístico
 * seguro quando malformado. NUNCA lança.
 */

import type {
  LaunchStrategyInput,
  LaunchStrategyOutput,
  LaunchKeyMessage,
  LaunchSuccessSignal,
  LaunchRiskFactor,
} from "./contracts";
import type { SkillSeverity } from "../shared/primitives";

const SEVERITIES: SkillSeverity[] = ["low", "medium", "high", "critical"];

const HEURISTIC_NOTE = "Estratégia heurística local: a análise detalhada do modelo não foi executada. Revise antes de operacionalizar.";

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

function mapKeyMessages(value: unknown): LaunchKeyMessage[] {
  return asRecordArray(value)
    .map((v) => ({ message: asString(v.message), audience: asString(v.audience, "público geral") }))
    .filter((v) => v.message.length > 0);
}

function mapSuccessSignals(value: unknown): LaunchSuccessSignal[] {
  return asRecordArray(value)
    .map((v) => ({ signal: asString(v.signal), why: asString(v.why) }))
    .filter((v) => v.signal.length > 0);
}

function mapRiskFactors(value: unknown): LaunchRiskFactor[] {
  return asRecordArray(value)
    .map((v) => ({ risk: asString(v.risk), severity: asSeverity(v.severity), mitigation: asString(v.mitigation) }))
    .filter((v) => v.risk.length > 0);
}

function buildFallback(input: LaunchStrategyInput): LaunchStrategyOutput {
  return {
    strategicNarrative: `${HEURISTIC_NOTE} Lançamento "${input.releaseTitle}" (${input.releaseType}).`,
    targetAudience: input.genre ? `Público de ${input.genre}.` : "Público-alvo não determinado heuristicamente.",
    competitivePositioning: "Definir posicionamento manualmente.",
    keyMessages: [],
    successSignals: [],
    riskFactors: [],
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

export function parseLaunchStrategyResponse(
  raw: string,
  input: LaunchStrategyInput,
): LaunchStrategyOutput {
  const json = extractJson(raw);
  const fallback = buildFallback(input);

  if (!json) return fallback;

  return {
    strategicNarrative: asString(json.strategicNarrative) || fallback.strategicNarrative,
    targetAudience: asString(json.targetAudience) || fallback.targetAudience,
    competitivePositioning: asString(json.competitivePositioning) || fallback.competitivePositioning,
    keyMessages: mapKeyMessages(json.keyMessages),
    successSignals: mapSuccessSignals(json.successSignals),
    riskFactors: mapRiskFactors(json.riskFactors),
  };
}

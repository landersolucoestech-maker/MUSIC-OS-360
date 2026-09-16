/**
 * packages/ai-skills/src/automation-builder/parser.ts
 *
 * Converte a resposta crua do provider em AutomationBuilderOutput estruturado.
 * Estratégia geral (igual às demais skills do pacote): extrai JSON
 * (com/sem cercas markdown), coage cada campo, cai para fallback heurístico
 * seguro quando malformado. NUNCA lança.
 */

import type {
  AutomationBuilderInput,
  AutomationBuilderOutput,
  AutomationBuilderMenuSuggestion,
  AutomationBuilderEscalationSuggestion,
  AutomationBuilderRisk,
} from "./contracts";
import type { SkillSeverity } from "../shared/primitives";

const SEVERITIES: SkillSeverity[] = ["low", "medium", "high", "critical"];

const HEURISTIC_NOTE = "Sugestões heurísticas locais: a análise detalhada do modelo não foi executada.";

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

function mapMenuChanges(value: unknown): AutomationBuilderMenuSuggestion[] {
  return asRecordArray(value)
    .map((v) => ({ change: asString(v.change), rationale: asString(v.rationale) }))
    .filter((v) => v.change.length > 0);
}

function mapEscalationChanges(value: unknown): AutomationBuilderEscalationSuggestion[] {
  return asRecordArray(value)
    .map((v) => ({ change: asString(v.change), rationale: asString(v.rationale) }))
    .filter((v) => v.change.length > 0);
}

function mapRisks(value: unknown): AutomationBuilderRisk[] {
  return asRecordArray(value)
    .map((v) => ({ risk: asString(v.risk), severity: asSeverity(v.severity) }))
    .filter((v) => v.risk.length > 0);
}

function buildFallback(input: AutomationBuilderInput): AutomationBuilderOutput {
  return {
    suggestionsSummary: `${HEURISTIC_NOTE} ${input.invalidOptionCount} mensagens sem correspondência de menu.`,
    suggestedMenuChanges: [],
    suggestedEscalationChanges: [],
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

export function parseAutomationBuilderResponse(
  raw: string,
  input: AutomationBuilderInput,
): AutomationBuilderOutput {
  const json = extractJson(raw);
  const fallback = buildFallback(input);

  if (!json) return fallback;

  return {
    suggestionsSummary: asString(json.suggestionsSummary) || fallback.suggestionsSummary,
    suggestedMenuChanges: mapMenuChanges(json.suggestedMenuChanges),
    suggestedEscalationChanges: mapEscalationChanges(json.suggestedEscalationChanges),
    risks: mapRisks(json.risks),
  };
}

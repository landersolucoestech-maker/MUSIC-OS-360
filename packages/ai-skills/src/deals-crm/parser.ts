/**
 * packages/ai-skills/src/deals-crm/parser.ts
 *
 * Converte a resposta crua do provider em DealsCrmOutput estruturado.
 * Estratégia geral (igual às demais skills do pacote): extrai JSON
 * (com/sem cercas markdown), coage cada campo, cai para fallback heurístico
 * seguro quando malformado. NUNCA lança.
 */

import type {
  DealsCrmInput,
  DealsCrmOutput,
  DealsCrmAction,
  DealsCrmRisk,
} from "./contracts";
import type { SkillPriority, SkillSeverity } from "../shared/primitives";

const PRIORITIES: SkillPriority[] = ["low", "medium", "high", "critical"];
const SEVERITIES: SkillSeverity[] = ["low", "medium", "high", "critical"];

const HEURISTIC_NOTE = "Análise heurística local: a análise detalhada do modelo não foi executada.";

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

function asPriority(value: unknown): SkillPriority {
  const v = asString(value).toLowerCase();
  return (PRIORITIES as string[]).includes(v) ? (v as SkillPriority) : "medium";
}

function asSeverity(value: unknown): SkillSeverity {
  const v = asString(value).toLowerCase();
  return (SEVERITIES as string[]).includes(v) ? (v as SkillSeverity) : "medium";
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is Record<string, unknown> => typeof v === "object" && v !== null);
}

function mapActions(value: unknown): DealsCrmAction[] {
  return asRecordArray(value)
    .map((v) => ({ action: asString(v.action), priority: asPriority(v.priority) }))
    .filter((v) => v.action.length > 0);
}

function mapRisks(value: unknown): DealsCrmRisk[] {
  return asRecordArray(value)
    .map((v) => ({ risk: asString(v.risk), severity: asSeverity(v.severity) }))
    .filter((v) => v.risk.length > 0);
}

function buildFallback(input: DealsCrmInput): DealsCrmOutput {
  const risks: DealsCrmRisk[] = [];
  const atRisk = input.deals.filter((d) => d.stage === "at_risk");
  if (atRisk.length > 0) {
    risks.push({ risk: `${atRisk.length} deal(s) em estágio de risco`, severity: "high" });
  }
  const missingValue = input.deals.filter((d) => d.value === null);
  if (missingValue.length > 0) {
    risks.push({ risk: `${missingValue.length} deal(s) sem valor registrado`, severity: "low" });
  }
  return {
    pipelineSummary: `${HEURISTIC_NOTE} Cliente "${input.clientName}" — ${input.deals.length} deal(s).`,
    recommendedActions: [],
    risks,
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

export function parseDealsCrmResponse(
  raw: string,
  input: DealsCrmInput,
): DealsCrmOutput {
  const json = extractJson(raw);
  const fallback = buildFallback(input);

  if (!json) return fallback;

  return {
    pipelineSummary: asString(json.pipelineSummary) || fallback.pipelineSummary,
    recommendedActions: mapActions(json.recommendedActions),
    risks: mapRisks(json.risks).length > 0 ? mapRisks(json.risks) : fallback.risks,
  };
}

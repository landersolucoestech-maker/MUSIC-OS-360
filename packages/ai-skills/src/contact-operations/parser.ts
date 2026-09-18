/**
 * packages/ai-skills/src/contact-operations/parser.ts
 *
 * Converte a resposta crua do provider em ContactOperationsOutput
 * estruturado. Estratégia geral (igual às demais skills do pacote): extrai
 * JSON (com/sem cercas markdown), coage cada campo, cai para fallback
 * heurístico seguro quando malformado. NUNCA lança.
 */

import type {
  ContactOperationsInput,
  ContactOperationsOutput,
  ContactOperationsAction,
  ContactOperationsGap,
} from "./contracts";
import type { SkillPriority } from "../shared/primitives";

const PRIORITIES: SkillPriority[] = ["low", "medium", "high", "critical"];

const HEURISTIC_NOTE = "Checklist heurístico local: a análise detalhada do modelo não foi executada.";

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

function asPriority(value: unknown): SkillPriority {
  const v = asString(value).toLowerCase();
  return (PRIORITIES as string[]).includes(v) ? (v as SkillPriority) : "medium";
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is Record<string, unknown> => typeof v === "object" && v !== null);
}

function mapActions(value: unknown): ContactOperationsAction[] {
  return asRecordArray(value)
    .map((v) => ({ action: asString(v.action), priority: asPriority(v.priority) }))
    .filter((v) => v.action.length > 0);
}

function mapGaps(value: unknown): ContactOperationsGap[] {
  return asRecordArray(value)
    .map((v) => ({ gap: asString(v.gap), reason: asString(v.reason) }))
    .filter((v) => v.gap.length > 0);
}

function buildFallback(input: ContactOperationsInput): ContactOperationsOutput {
  const gaps: ContactOperationsGap[] = [];
  if (!input.responsavelNome?.trim()) {
    gaps.push({ gap: "Nenhum responsável definido", reason: "responsavelNome não informado" });
  }
  return {
    onboardingSummary: `${HEURISTIC_NOTE} Cliente "${input.clientName}".`,
    recommendedActions: [
      { action: "Definir responsável interno pelo cliente", priority: "high" },
      { action: "Agendar reunião de kickoff", priority: "medium" },
    ],
    dataGaps: gaps,
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

export function parseContactOperationsResponse(
  raw: string,
  input: ContactOperationsInput,
): ContactOperationsOutput {
  const json = extractJson(raw);
  const fallback = buildFallback(input);

  if (!json) return fallback;

  return {
    onboardingSummary: asString(json.onboardingSummary) || fallback.onboardingSummary,
    recommendedActions: mapActions(json.recommendedActions).length > 0
      ? mapActions(json.recommendedActions)
      : fallback.recommendedActions,
    dataGaps: mapGaps(json.dataGaps),
  };
}

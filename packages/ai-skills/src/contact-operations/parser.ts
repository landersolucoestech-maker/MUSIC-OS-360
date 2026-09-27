/**
 * packages/ai-skills/src/contact-operations/parser.ts
 *
 * Converts the provider's raw response into a structured
 * ContactOperationsOutput. General strategy (same as the package's other
 * skills): extracts JSON (with/without markdown fences), coerces each field, and
 * falls back to a safe heuristic output when malformed. NEVER throws.
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
    gaps.push({ gap: "Nenhum responsável definido", reason: "Nome do responsável não informado" });
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
    // ignore — the response was not valid JSON
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
